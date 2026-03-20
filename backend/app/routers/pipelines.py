"""Pipeline CRUD + SQL generation endpoint."""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.pipeline import Pipeline, PipelineNode, PipelineEdge, DataSource
from app.schemas.pipeline import (
    PipelineCreate, PipelineSave, PipelineOut, PipelineDetail,
    GenerateSQLRequest, GenerateSQLResponse,
)
from app.services import sql_gen as sql_gen_svc
from app.services.execution import build_available_tables

router = APIRouter()


@router.get("", response_model=list[PipelineOut])
async def list_pipelines(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Pipeline)
        .where(Pipeline.user_id == current_user.id)
        .order_by(Pipeline.updated_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=PipelineOut, status_code=status.HTTP_201_CREATED)
async def create_pipeline(
    payload: PipelineCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pipeline = Pipeline(
        user_id=current_user.id,
        name=payload.name,
        description=payload.description,
        canvas_state={},
    )
    db.add(pipeline)
    await db.flush()
    await db.refresh(pipeline)
    return pipeline


@router.get("/{pipeline_id}", response_model=PipelineDetail)
async def get_pipeline(
    pipeline_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pipeline = await _get_owned_pipeline(pipeline_id, current_user, db)
    nodes = (await db.execute(select(PipelineNode).where(PipelineNode.pipeline_id == pipeline_id))).scalars().all()
    edges = (await db.execute(select(PipelineEdge).where(PipelineEdge.pipeline_id == pipeline_id))).scalars().all()
    return PipelineDetail.model_validate({
        **pipeline.__dict__,
        "nodes": nodes,
        "edges": edges,
    })


@router.put("/{pipeline_id}")
async def save_pipeline(
    pipeline_id: uuid.UUID,
    payload: PipelineSave,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pipeline = await _get_owned_pipeline(pipeline_id, current_user, db)

    if payload.name is not None:
        pipeline.name = payload.name
    if payload.description is not None:
        pipeline.description = payload.description
    if payload.canvas_state is not None:
        pipeline.canvas_state = payload.canvas_state

    if payload.nodes is not None:
        # Delete all existing nodes — CASCADE removes their edges too
        existing_nodes = (
            await db.execute(select(PipelineNode).where(PipelineNode.pipeline_id == pipeline_id))
        ).scalars().all()
        for n in existing_nodes:
            await db.delete(n)
        # Flush node deletions first so FK constraints are clean before re-inserting
        await db.flush()

        for n in payload.nodes:
            db.add(PipelineNode(
                id=uuid.UUID(n.id),
                pipeline_id=pipeline_id,
                label=n.label,
                slug=n.slug,
                node_type=n.node_type,
                data_source_id=uuid.UUID(n.data_source_id) if n.data_source_id else None,
                prompt=n.prompt,
                sql=n.sql,
                position_x=n.position_x,
                position_y=n.position_y,
            ))
        # Flush nodes so edges can reference them via FK
        await db.flush()

    if payload.edges is not None:
        # Edges were already cascade-deleted with nodes above; just insert the new ones
        for e in payload.edges:
            db.add(PipelineEdge(
                id=uuid.UUID(e.id),
                pipeline_id=pipeline_id,
                source_node_id=uuid.UUID(e.source_node_id),
                target_node_id=uuid.UUID(e.target_node_id),
            ))
        await db.flush()

    return {"ok": True}


@router.delete("/{pipeline_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pipeline(
    pipeline_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pipeline = await _get_owned_pipeline(pipeline_id, current_user, db)
    await db.delete(pipeline)


@router.post("/{pipeline_id}/generate-sql", response_model=GenerateSQLResponse)
async def generate_sql(
    pipeline_id: uuid.UUID,
    payload: GenerateSQLRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Call Claude Haiku to convert a natural language prompt to DuckDB SQL."""
    await _get_owned_pipeline(pipeline_id, current_user, db)

    nodes = (await db.execute(select(PipelineNode).where(PipelineNode.pipeline_id == pipeline_id))).scalars().all()
    edges = (await db.execute(select(PipelineEdge).where(PipelineEdge.pipeline_id == pipeline_id))).scalars().all()
    data_sources = (await db.execute(select(DataSource).where(DataSource.user_id == current_user.id))).scalars().all()

    nodes_dict = [{"id": str(n.id), "label": n.label, "slug": n.slug} for n in nodes]
    edges_dict = [{"source_node_id": str(e.source_node_id), "target_node_id": str(e.target_node_id)} for e in edges]
    sources_dict = [{"slug": ds.slug, "name": ds.name, "column_schema": ds.column_schema or []} for ds in data_sources]

    available_tables = build_available_tables(nodes_dict, edges_dict, payload.node_id, sources_dict)

    sql = sql_gen_svc.generate_sql(payload.prompt, available_tables)
    return GenerateSQLResponse(sql=sql)


async def _get_owned_pipeline(pipeline_id: uuid.UUID, user: User, db: AsyncSession) -> Pipeline:
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id, Pipeline.user_id == user.id))
    pipeline = result.scalar_one_or_none()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return pipeline
