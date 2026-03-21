"""pipeline folders

Revision ID: 002
Revises: 001
Create Date: 2026-03-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pipeline_folders",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("emoji", sa.String(10), nullable=False, server_default="📁"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_pipeline_folders_user_id", "pipeline_folders", ["user_id"])
    op.add_column("pipelines", sa.Column(
        "folder_id", UUID(as_uuid=True),
        sa.ForeignKey("pipeline_folders.id", ondelete="SET NULL"),
        nullable=True,
    ))
    op.add_column("pipelines", sa.Column("emoji", sa.String(10), nullable=True))


def downgrade() -> None:
    op.drop_column("pipelines", "emoji")
    op.drop_column("pipelines", "folder_id")
    op.drop_index("ix_pipeline_folders_user_id", "pipeline_folders")
    op.drop_table("pipeline_folders")
