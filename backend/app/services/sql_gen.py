"""Claude-powered natural language → DuckDB SQL generation."""
import logging
from typing import Optional

import anthropic

from app.config import settings

logger = logging.getLogger(__name__)

_client: Optional[anthropic.Anthropic] = None


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return _client


def _build_schema_context(available_tables: list[dict]) -> str:
    """
    available_tables: [
        {"name": "raw_invoices", "columns": [{"name": "col", "dtype": "TEXT"}], "description": "uploaded file: invoices.csv"},
        ...
    ]
    """
    if not available_tables:
        return "No tables are available yet. This must be a source node — use a SELECT with literal VALUES or load from an uploaded file."

    lines = []
    for t in available_tables:
        cols = ", ".join(f"{c['name']} {c['dtype'].upper()}" for c in t.get("columns", []))
        desc = t.get("description", "")
        lines.append(f'- "{t["name"]}": ({cols})  -- {desc}')
    return "\n".join(lines)


def generate_sql(prompt: str, available_tables: list[dict]) -> str:
    """
    Call Claude Haiku to convert a natural language prompt to DuckDB SQL.
    Returns only the SQL string (no markdown, no explanation).
    """
    schema_ctx = _build_schema_context(available_tables)

    system = """You are a DuckDB SQL expert helping an accountant build a data pipeline.
Your job is to write a single DuckDB SELECT statement based on the user's plain-English request.

Rules:
- Return ONLY the SQL statement, no explanation, no markdown fences.
- Always write a SELECT statement (never INSERT, UPDATE, DELETE, DROP, CREATE, or COPY).
- Reference tables exactly by their names shown in the available tables list.
- Use standard DuckDB SQL syntax. DuckDB supports CTEs, window functions, PIVOT, UNPIVOT, regex, and most Postgres syntax.
- Column names with spaces or special characters must be quoted with double-quotes.
- When joining, use meaningful aliases to avoid ambiguity.
- If the request is ambiguous, make a reasonable assumption and write the SQL.
"""

    user_msg = f"""Available tables:
{schema_ctx}

User request: {prompt}

Write the DuckDB SQL SELECT statement:"""

    client = get_client()
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=system,
        messages=[{"role": "user", "content": user_msg}],
    )

    sql = message.content[0].text.strip()

    # Strip markdown fences if Claude added them anyway
    if sql.startswith("```"):
        lines = sql.split("\n")
        sql = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])

    return sql.strip()
