"""
DuckDB pipeline execution engine.

Each node's output is stored as a parquet file in Supabase Storage.
When a node runs, its upstream dependencies are registered as DuckDB views,
then the node's SQL is executed and the result is persisted.
"""
import io
import logging
import re
import time
from collections import deque
from typing import Optional
from uuid import UUID

import duckdb
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from app.services.storage import download_file, upload_file

logger = logging.getLogger(__name__)

# Max rows per DataFrame before we raise a limit error
MAX_ROWS = 500_000

PREVIEW_ROWS = 200


def topological_sort(nodes: list[dict], edges: list[dict]) -> list[dict]:
    """
    Kahn's algorithm — returns nodes in execution order.
    nodes: [{"id": "...", ...}]
    edges: [{"source_node_id": "...", "target_node_id": "..."}]
    Raises ValueError if a cycle is detected.
    """
    node_map = {n["id"]: n for n in nodes}
    in_degree = {n["id"]: 0 for n in nodes}
    children: dict[str, list[str]] = {n["id"]: [] for n in nodes}

    for edge in edges:
        src = edge["source_node_id"]
        tgt = edge["target_node_id"]
        children[src].append(tgt)
        in_degree[tgt] += 1

    queue = deque(nid for nid, deg in in_degree.items() if deg == 0)
    order = []

    while queue:
        nid = queue.popleft()
        order.append(node_map[nid])
        for child in children[nid]:
            in_degree[child] -= 1
            if in_degree[child] == 0:
                queue.append(child)

    if len(order) != len(nodes):
        raise ValueError("Pipeline contains a cycle — cannot execute.")

    return order


def _parquet_path(run_id: str, node_id: str) -> str:
    return f"runs/{run_id}/{node_id}.parquet"


def _df_to_parquet_bytes(df: pd.DataFrame) -> bytes:
    table = pa.Table.from_pandas(df, preserve_index=False)
    buf = io.BytesIO()
    pq.write_table(table, buf, compression="snappy")
    return buf.getvalue()


def _parquet_bytes_to_df(data: bytes) -> pd.DataFrame:
    buf = io.BytesIO(data)
    return pq.read_table(buf).to_pandas()


def _infer_schema(df: pd.DataFrame) -> list[dict]:
    """Convert pandas dtypes to friendly schema for the frontend."""
    dtype_map = {
        "object": "TEXT",
        "string": "TEXT",
        "int64": "INTEGER",
        "int32": "INTEGER",
        "float64": "FLOAT",
        "float32": "FLOAT",
        "bool": "BOOLEAN",
    }
    schema = []
    for col in df.columns:
        dtype_str = str(df[col].dtype)
        friendly = dtype_map.get(dtype_str, "TEXT")
        if "datetime" in dtype_str:
            friendly = "DATE"
        schema.append({"name": col, "dtype": friendly})
    return schema


def _extract_table_refs(sql: str) -> set[str]:
    """
    Extract table/view names from FROM and JOIN clauses in a SQL string.
    CTE names (defined within the query via WITH) are excluded — they are local aliases.
    """
    # Strip single-line and block comments
    sql = re.sub(r"--[^\n]*", " ", sql)
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.DOTALL)

    # Collect CTE names so we don't flag them as external references
    cte_names: set[str] = set()
    # WITH cte1 AS (...), cte2 AS (...)
    for m in re.finditer(r"\bWITH\b(.*?)(?=\bSELECT\b)", sql, re.IGNORECASE | re.DOTALL):
        for name in re.findall(r"\b(\w+)\s+AS\s*\(", m.group(1), re.IGNORECASE):
            cte_names.add(name.lower())

    # Extract bare and double-quoted names after FROM / JOIN keywords
    pattern = re.compile(
        r'\b(?:FROM|JOIN)\s+(?:"([^"]+)"|([a-zA-Z_]\w*))',
        re.IGNORECASE,
    )
    refs: set[str] = set()
    for m in pattern.finditer(sql):
        name = (m.group(1) or m.group(2) or "").lower()
        if name and name not in cte_names:
            refs.add(name)

    return refs


def validate_node_references(
    sql: str,
    subsequent_slugs: set[str],
    node_label: str,
) -> None:
    """
    Raise ValueError if the node's SQL references any slug that belongs to a
    subsequent (not-yet-executed) node — i.e. a forward reference.

    subsequent_slugs: slugs of all nodes that come *after* this node in
                      topological execution order.
    """
    if not sql or not subsequent_slugs:
        return

    refs = _extract_table_refs(sql)
    violations = refs & {s.lower() for s in subsequent_slugs}

    if violations:
        names = ", ".join(sorted(violations))
        raise ValueError(
            f"Node '{node_label}' references '{names}', which "
            f"belong(s) to a subsequent step. Each node can only query "
            f"previous node outputs and data sources — not future steps."
        )


def execute_node(
    node: dict,
    conn: duckdb.DuckDBPyConnection,
    run_id: str,
    max_rows: int = MAX_ROWS,
) -> dict:
    """
    Execute a single node's SQL using an already-configured DuckDB connection
    (upstream views already registered). Returns result metadata dict.
    """
    node_id = str(node["id"])
    sql = node.get("sql", "").strip()

    if not sql:
        raise ValueError(f"Node '{node['label']}' has no SQL. Generate or write SQL before running.")

    t0 = time.monotonic()
    try:
        df = conn.execute(sql).df()
    except Exception as exc:
        # Clean up DuckDB error messages — strip internal line numbers
        msg = str(exc).split("\n")[0]
        raise RuntimeError(f"SQL error in node '{node['label']}': {msg}") from exc

    elapsed_ms = int((time.monotonic() - t0) * 1000)

    if len(df) > max_rows:
        raise RuntimeError(
            f"Node '{node['label']}' produced {len(df):,} rows which exceeds the {max_rows:,} row limit."
        )

    # Persist to Supabase Storage
    parquet_bytes = _df_to_parquet_bytes(df)
    path = _parquet_path(run_id, node_id)
    upload_file(path, parquet_bytes, content_type="application/octet-stream")

    # Build preview (first N rows as list of dicts)
    preview_df = df.head(PREVIEW_ROWS)
    # Convert timestamps/dates to ISO strings for JSON serialisation
    for col in preview_df.select_dtypes(include=["datetime64[ns]", "datetime64[ns, UTC]"]).columns:
        preview_df[col] = preview_df[col].astype(str)
    preview_rows = preview_df.to_dict(orient="records")

    return {
        "storage_path": path,
        "row_count": len(df),
        "column_schema": _infer_schema(df),
        "preview_rows": preview_rows,
        "execution_ms": elapsed_ms,
        "_df": df,  # kept in memory so downstream nodes in same run can register it as a view
    }


def load_node_result_df(run_id: str, node_id: str) -> pd.DataFrame:
    """Load a node's parquet result from Supabase Storage back into a DataFrame."""
    path = _parquet_path(run_id, node_id)
    data = download_file(path)
    return _parquet_bytes_to_df(data)


def get_paginated_rows(run_id: str, node_id: str, offset: int = 0, limit: int = 200) -> dict:
    """Return paginated rows from a stored node result."""
    df = load_node_result_df(run_id, node_id)
    total = len(df)
    page = df.iloc[offset: offset + limit]
    for col in page.select_dtypes(include=["datetime64[ns]", "datetime64[ns, UTC]"]).columns:
        page[col] = page[col].astype(str)
    return {
        "rows": page.to_dict(orient="records"),
        "total": total,
        "offset": offset,
        "limit": limit,
    }


def build_available_tables(
    nodes: list[dict],
    edges: list[dict],
    target_node_id: str,
    data_sources: list[dict],
) -> list[dict]:
    """
    For the SQL generation prompt: returns metadata about tables the target node can reference.
    Includes: all data_sources + all upstream nodes (predecessors of target_node_id).
    """
    # Find all ancestors of target_node_id
    parents: dict[str, list[str]] = {n["id"]: [] for n in nodes}
    for edge in edges:
        parents[edge["target_node_id"]].append(edge["source_node_id"])

    ancestors = set()
    queue = deque(parents.get(target_node_id, []))
    while queue:
        nid = queue.popleft()
        if nid not in ancestors:
            ancestors.add(nid)
            queue.extend(parents.get(nid, []))

    node_map = {n["id"]: n for n in nodes}
    tables = []

    # Upstream nodes
    for nid in ancestors:
        n = node_map[nid]
        tables.append({
            "name": n["slug"],
            "columns": [],  # will be filled if we have a prior run result
            "description": f"output of node: \"{n['label']}\"",
        })

    # Uploaded data sources
    for ds in data_sources:
        tables.append({
            "name": ds["slug"],
            "columns": ds.get("column_schema") or [],
            "description": f"uploaded file: {ds['name']}",
        })

    return tables
