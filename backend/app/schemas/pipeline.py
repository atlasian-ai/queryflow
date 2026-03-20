from uuid import UUID
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel


# ── Data Sources ──────────────────────────────────────────────────────────────

class DataSourceOut(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    user_id: UUID
    name: str
    slug: str
    file_type: str
    row_count: Optional[int]
    column_schema: Optional[list]
    size_bytes: Optional[int]
    created_at: datetime


# ── Pipeline ──────────────────────────────────────────────────────────────────

class PipelineCreate(BaseModel):
    name: str
    description: Optional[str] = None


class PipelineNodeIn(BaseModel):
    id: str  # client-generated UUID string
    label: str
    slug: str
    node_type: str = "transform"
    data_source_id: Optional[str] = None
    prompt: Optional[str] = None
    sql: Optional[str] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None


class PipelineEdgeIn(BaseModel):
    id: str
    source_node_id: str
    target_node_id: str


class PipelineSave(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    canvas_state: Optional[dict] = None
    nodes: Optional[list[PipelineNodeIn]] = None
    edges: Optional[list[PipelineEdgeIn]] = None


class PipelineNodeOut(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    pipeline_id: UUID
    label: str
    slug: str
    node_type: str
    data_source_id: Optional[UUID]
    prompt: Optional[str]
    sql: Optional[str]
    position_x: Optional[float]
    position_y: Optional[float]
    created_at: datetime
    updated_at: datetime


class PipelineEdgeOut(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    pipeline_id: UUID
    source_node_id: UUID
    target_node_id: UUID


class PipelineOut(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    user_id: UUID
    name: str
    description: Optional[str]
    canvas_state: dict
    created_at: datetime
    updated_at: datetime


class PipelineDetail(PipelineOut):
    nodes: list[PipelineNodeOut] = []
    edges: list[PipelineEdgeOut] = []


# ── Runs ──────────────────────────────────────────────────────────────────────

class RunOut(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    pipeline_id: UUID
    triggered_by: UUID
    status: str
    error_message: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime


class NodeResultOut(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    run_id: UUID
    node_id: UUID
    status: str
    row_count: Optional[int]
    column_schema: Optional[list]
    preview_rows: Optional[list]
    error_message: Optional[str]
    execution_ms: Optional[int]


class RunDetail(RunOut):
    node_results: list[NodeResultOut] = []


# ── SQL Generation ────────────────────────────────────────────────────────────

class GenerateSQLRequest(BaseModel):
    prompt: str
    node_id: str


class GenerateSQLResponse(BaseModel):
    sql: str
