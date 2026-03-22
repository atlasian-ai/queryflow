"""
Celery task: execute_pipeline

Runs a full pipeline by executing nodes in topological order.
Each node's SQL is run via DuckDB. Results are stored as parquet in Supabase Storage
and previews are cached inline in node_results.
"""
import logging
from datetime import datetime, timezone
from uuid import UUID

import duckdb
import pandas as pd

from app.workers.celery_app import celery_app
from app.config import settings
from app.services import execution as exec_svc
from app.services.storage import download_file

logger = logging.getLogger(__name__)


def _get_db_session():
    """Synchronous DB session for Celery tasks (uses psycopg2 via SQLAlchemy sync engine)."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    # Convert asyncpg URL to psycopg2 and strip asyncpg-specific params
    sync_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    if "?" in sync_url:
        base, params = sync_url.split("?", 1)
        # Remove params that are asyncpg-specific and unsupported by psycopg2
        filtered = "&".join(
            p for p in params.split("&")
            if not p.startswith("statement_cache_size")
        )
        sync_url = f"{base}?{filtered}" if filtered else base

    engine = create_engine(sync_url, pool_pre_ping=True, connect_args={"connect_timeout": 10})
    Session = sessionmaker(bind=engine)
    return Session()


def run_pipeline_sync(run_id: str) -> None:
    """Execute all nodes of a pipeline run in topological order (sync, no Celery)."""
    from app.models.pipeline import Pipeline, PipelineNode, PipelineEdge, PipelineRun, NodeResult, DataSource

    db = _get_db_session()
    try:
        # Load the run
        run = db.query(PipelineRun).filter_by(id=run_id).first()
        if not run:
            logger.error(f"Run {run_id} not found")
            return

        # Mark run as started
        run.status = "running"
        run.started_at = datetime.now(timezone.utc)
        db.commit()

        pipeline_id = str(run.pipeline_id)

        # Load nodes and edges
        nodes_orm = db.query(PipelineNode).filter_by(pipeline_id=pipeline_id).all()
        edges_orm = db.query(PipelineEdge).filter_by(pipeline_id=pipeline_id).all()

        nodes = [
            {
                "id": str(n.id),
                "label": n.label,
                "slug": n.slug,
                "node_type": n.node_type,
                "data_source_id": str(n.data_source_id) if n.data_source_id else None,
                "sql": n.sql,
            }
            for n in nodes_orm
        ]
        edges = [
            {
                "source_node_id": str(e.source_node_id),
                "target_node_id": str(e.target_node_id),
            }
            for e in edges_orm
        ]

        # Load all data sources for this user's pipeline
        pipeline = db.query(Pipeline).filter_by(id=pipeline_id).first()
        data_sources_orm = db.query(DataSource).filter_by(user_id=pipeline.user_id).all()

        # Create/reset node_result rows
        for node in nodes:
            existing = db.query(NodeResult).filter_by(run_id=run_id, node_id=node["id"]).first()
            if existing:
                existing.status = "pending"
                existing.error_message = None
                existing.storage_path = None
                existing.row_count = None
                existing.preview_rows = None
            else:
                db.add(NodeResult(run_id=run_id, node_id=node["id"], status="pending"))
        db.commit()

        # Topological sort
        try:
            ordered_nodes = exec_svc.topological_sort(nodes, edges)
        except ValueError as e:
            run.status = "failed"
            run.error_message = str(e)
            run.completed_at = datetime.now(timezone.utc)
            db.commit()
            return

        # Build DuckDB connection and register data sources as views
        conn = duckdb.connect()

        for ds in data_sources_orm:
            try:
                parquet_data = download_file(ds.storage_path)
                import io
                import pyarrow.parquet as pq
                buf = io.BytesIO(parquet_data)
                df_ds = pq.read_table(buf).to_pandas()
                conn.register(ds.slug, df_ds)
                logger.info(f"Registered data source '{ds.slug}' ({len(df_ds)} rows)")
            except Exception as e:
                logger.warning(f"Could not load data source '{ds.slug}': {e}")

        # Node result cache: node_id -> DataFrame (kept in memory during run)
        result_cache: dict[str, pd.DataFrame] = {}

        # Pre-compute slugs of every node for forward-reference validation
        all_slugs_in_order = [n["slug"] for n in ordered_nodes]
        data_source_slugs = {ds.slug for ds in data_sources_orm}

        # Execute nodes in order
        for node in ordered_nodes:
            node_id = node["id"]

            # Mark node as running
            nr = db.query(NodeResult).filter_by(run_id=run_id, node_id=node_id).first()
            nr.status = "running"
            db.commit()

            # Register upstream results as DuckDB views
            parents = [e["source_node_id"] for e in edges if e["target_node_id"] == node_id]
            for parent_id in parents:
                if parent_id in result_cache:
                    parent_node = next(n for n in nodes if n["id"] == parent_id)
                    conn.register(parent_node["slug"], result_cache[parent_id])

            # Validate: reject forward references to subsequent nodes
            current_index = all_slugs_in_order.index(node["slug"])
            subsequent_slugs = set(all_slugs_in_order[current_index + 1:])

            # Execute
            try:
                exec_svc.validate_node_references(
                    node.get("sql", ""),
                    subsequent_slugs,
                    node["label"],
                )
                result = exec_svc.execute_node(node, conn, run_id, max_rows=settings.max_rows_pro)

                nr.status = "success"
                nr.storage_path = result["storage_path"]
                nr.row_count = result["row_count"]
                nr.column_schema = result["column_schema"]
                nr.preview_rows = result["preview_rows"]
                nr.execution_ms = result["execution_ms"]
                db.commit()

                # Cache the DataFrame for downstream nodes
                result_cache[node_id] = result["_df"]

                # Also register this node's output as a view for subsequent nodes
                conn.register(node["slug"], result["_df"])

            except Exception as exc:
                logger.error(f"Node {node['label']} failed: {exc}")
                nr.status = "failed"
                nr.error_message = str(exc)
                db.commit()

                run.status = "failed"
                run.error_message = f"Node '{node['label']}' failed: {exc}"
                run.completed_at = datetime.now(timezone.utc)
                db.commit()
                return

        conn.close()

        # All nodes succeeded
        run.status = "success"
        run.completed_at = datetime.now(timezone.utc)
        db.commit()
        logger.info(f"Pipeline run {run_id} completed successfully")

    except Exception as exc:
        logger.exception(f"Unexpected error in run {run_id}: {exc}")
        try:
            run = db.query(PipelineRun).filter_by(id=run_id).first()
            if run:
                run.status = "failed"
                run.error_message = f"Internal error: {exc}"
                run.completed_at = datetime.now(timezone.utc)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


@celery_app.task(bind=True, name="execute_pipeline")
def execute_pipeline(self, run_id: str):
    """Celery wrapper — delegates to run_pipeline_sync."""
    run_pipeline_sync(run_id)
