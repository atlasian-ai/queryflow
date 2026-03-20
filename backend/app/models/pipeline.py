import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DataSource(Base):
    """An uploaded file (CSV or XLSX) available as a DuckDB view."""
    __tablename__ = "data_sources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)  # SQL-safe name for DuckDB view
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_type: Mapped[str] = mapped_column(String(20), nullable=False)  # csv | xlsx
    row_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    column_schema: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # [{name, dtype}]
    size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Pipeline(Base):
    __tablename__ = "pipelines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    canvas_state: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)  # @xyflow/react viewport state
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PipelineNode(Base):
    """A single transform step in the pipeline canvas."""
    __tablename__ = "pipeline_nodes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pipeline_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)  # user-defined display name
    slug: Mapped[str] = mapped_column(String(255), nullable=False)   # SQL-safe table alias for DuckDB
    node_type: Mapped[str] = mapped_column(String(50), nullable=False, default="transform")  # source | transform
    data_source_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("data_sources.id"), nullable=True)  # set for source nodes
    prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)   # natural language input
    sql: Mapped[Optional[str]] = mapped_column(Text, nullable=True)      # DuckDB SQL
    position_x: Mapped[Optional[float]] = mapped_column(nullable=True)
    position_y: Mapped[Optional[float]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PipelineEdge(Base):
    __tablename__ = "pipeline_edges"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pipeline_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False)
    source_node_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pipeline_nodes.id", ondelete="CASCADE"), nullable=False)
    target_node_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pipeline_nodes.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pipeline_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False)
    triggered_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")  # pending | running | success | failed
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class NodeResult(Base):
    """Cached output for a node in a specific run."""
    __tablename__ = "node_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pipeline_runs.id", ondelete="CASCADE"), nullable=False)
    node_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pipeline_nodes.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")  # pending | running | success | failed | skipped
    storage_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)   # Supabase Storage path to parquet
    row_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    column_schema: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)  # [{name, dtype}]
    preview_rows: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)   # first 200 rows inline
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    execution_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
