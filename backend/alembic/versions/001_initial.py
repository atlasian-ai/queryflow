"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-03-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("supabase_id", UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("role", sa.String(50), nullable=False, server_default="member"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "data_sources",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("storage_path", sa.Text(), nullable=False),
        sa.Column("file_type", sa.String(20), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=True),
        sa.Column("column_schema", JSONB(), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_data_sources_user_id", "data_sources", ["user_id"])

    op.create_table(
        "pipelines",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("canvas_state", JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_pipelines_user_id", "pipelines", ["user_id"])

    op.create_table(
        "pipeline_nodes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("pipeline_id", UUID(as_uuid=True), sa.ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("label", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("node_type", sa.String(50), nullable=False, server_default="transform"),
        sa.Column("data_source_id", UUID(as_uuid=True), sa.ForeignKey("data_sources.id"), nullable=True),
        sa.Column("prompt", sa.Text(), nullable=True),
        sa.Column("sql", sa.Text(), nullable=True),
        sa.Column("position_x", sa.Float(), nullable=True),
        sa.Column("position_y", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_pipeline_nodes_pipeline_id", "pipeline_nodes", ["pipeline_id"])

    op.create_table(
        "pipeline_edges",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("pipeline_id", UUID(as_uuid=True), sa.ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_node_id", UUID(as_uuid=True), sa.ForeignKey("pipeline_nodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_node_id", UUID(as_uuid=True), sa.ForeignKey("pipeline_nodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_pipeline_edges_pipeline_id", "pipeline_edges", ["pipeline_id"])

    op.create_table(
        "pipeline_runs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("pipeline_id", UUID(as_uuid=True), sa.ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("triggered_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_pipeline_runs_pipeline_id", "pipeline_runs", ["pipeline_id"])

    op.create_table(
        "node_results",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("run_id", UUID(as_uuid=True), sa.ForeignKey("pipeline_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("node_id", UUID(as_uuid=True), sa.ForeignKey("pipeline_nodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("storage_path", sa.Text(), nullable=True),
        sa.Column("row_count", sa.Integer(), nullable=True),
        sa.Column("column_schema", JSONB(), nullable=True),
        sa.Column("preview_rows", JSONB(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("execution_ms", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_node_results_run_id", "node_results", ["run_id"])
    op.create_index("ix_node_results_run_node", "node_results", ["run_id", "node_id"])


def downgrade() -> None:
    op.drop_table("node_results")
    op.drop_table("pipeline_runs")
    op.drop_table("pipeline_edges")
    op.drop_table("pipeline_nodes")
    op.drop_table("pipelines")
    op.drop_table("data_sources")
    op.drop_table("users")
