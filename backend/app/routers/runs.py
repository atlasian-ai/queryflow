"""Pipeline run management — trigger, poll, fetch results, download."""
import io
import uuid

import pandas as pd
import pyarrow.parquet as pq
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.pipeline import Pipeline, PipelineRun, NodeResult
from app.schemas.pipeline import RunOut, RunDetail, NodeResultOut
from app.services.storage import download_file
from app.workers.tasks import execute_pipeline

router = APIRouter()


@router.post("/{pipeline_id}/run", response_model=RunOut, status_code=202)
async def trigger_run(
    pipeline_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id, Pipeline.user_id == current_user.id))
    pipeline = result.scalar_one_or_none()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    run = PipelineRun(
        pipeline_id=pipeline_id,
        triggered_by=current_user.id,
        status="pending",
    )
    db.add(run)
    await db.flush()
    await db.refresh(run)

    # Enqueue Celery task
    execute_pipeline.delay(str(run.id))

    return run


@router.get("/runs/{run_id}", response_model=RunDetail)
async def get_run(
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = await _get_owned_run(run_id, current_user, db)
    node_results = (await db.execute(select(NodeResult).where(NodeResult.run_id == run_id))).scalars().all()
    return RunDetail.model_validate({**run.__dict__, "node_results": node_results})


@router.get("/{pipeline_id}/runs", response_model=list[RunOut])
async def list_runs(
    pipeline_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id, Pipeline.user_id == current_user.id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Pipeline not found")

    runs = (await db.execute(
        select(PipelineRun)
        .where(PipelineRun.pipeline_id == pipeline_id)
        .order_by(PipelineRun.created_at.desc())
        .limit(50)
    )).scalars().all()
    return runs


@router.get("/runs/{run_id}/nodes/{node_id}/data")
async def get_node_data(
    run_id: uuid.UUID,
    node_id: uuid.UUID,
    offset: int = 0,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_owned_run(run_id, current_user, db)
    nr = await _get_node_result(run_id, node_id, db)

    # Return inline preview if within first 200 rows
    if offset == 0 and limit <= 200 and nr.preview_rows is not None:
        return {
            "rows": nr.preview_rows[:limit],
            "total": nr.row_count or 0,
            "offset": offset,
            "limit": limit,
            "column_schema": nr.column_schema,
        }

    # Otherwise fetch full parquet
    if not nr.storage_path:
        raise HTTPException(status_code=404, detail="No result data available")

    from app.services.execution import get_paginated_rows
    data = get_paginated_rows(str(run_id), str(node_id), offset, limit)
    data["column_schema"] = nr.column_schema
    return data


@router.get("/runs/{run_id}/nodes/{node_id}/download")
async def download_node_result(
    run_id: uuid.UUID,
    node_id: uuid.UUID,
    format: str = "csv",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_owned_run(run_id, current_user, db)
    nr = await _get_node_result(run_id, node_id, db)

    if not nr.storage_path:
        raise HTTPException(status_code=404, detail="No result data available for this node")

    parquet_data = download_file(nr.storage_path)
    df = pq.read_table(io.BytesIO(parquet_data)).to_pandas()

    if format == "xlsx":
        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as writer:
            df.to_excel(writer, index=False)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=result_{node_id}.xlsx"},
        )
    else:
        csv_data = df.to_csv(index=False).encode("utf-8")
        return StreamingResponse(
            io.BytesIO(csv_data),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=result_{node_id}.csv"},
        )


async def _get_owned_run(run_id: uuid.UUID, user: User, db: AsyncSession) -> PipelineRun:
    result = await db.execute(
        select(PipelineRun)
        .join(Pipeline, PipelineRun.pipeline_id == Pipeline.id)
        .where(PipelineRun.id == run_id, Pipeline.user_id == user.id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


async def _get_node_result(run_id: uuid.UUID, node_id: uuid.UUID, db: AsyncSession) -> NodeResult:
    result = await db.execute(select(NodeResult).where(NodeResult.run_id == run_id, NodeResult.node_id == node_id))
    nr = result.scalar_one_or_none()
    if not nr:
        raise HTTPException(status_code=404, detail="Node result not found")
    return nr
