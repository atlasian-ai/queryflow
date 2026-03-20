"""Data source management — upload CSV/XLSX files."""
import io
import uuid
from typing import Optional

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from slugify import slugify

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.pipeline import DataSource
from app.schemas.pipeline import DataSourceOut
from app.services.storage import upload_file, delete_file
from app.services.execution import _infer_schema

router = APIRouter()

ALLOWED_TYPES = {"text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


def _read_file_to_df(filename: str, data: bytes) -> pd.DataFrame:
    if filename.endswith(".csv"):
        return pd.read_csv(io.BytesIO(data))
    elif filename.endswith((".xlsx", ".xls")):
        return pd.read_excel(io.BytesIO(data))
    raise ValueError(f"Unsupported file type: {filename}")


def _df_to_parquet_bytes(df: pd.DataFrame) -> bytes:
    table = pa.Table.from_pandas(df, preserve_index=False)
    buf = io.BytesIO()
    pq.write_table(table, buf, compression="snappy")
    return buf.getvalue()


def _unique_slug(base_slug: str, existing_slugs: set[str]) -> str:
    slug = base_slug
    counter = 1
    while slug in existing_slugs:
        slug = f"{base_slug}_{counter}"
        counter += 1
    return slug


@router.post("", response_model=DataSourceOut, status_code=status.HTTP_201_CREATED)
async def upload_source(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = await file.read()

    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 50 MB)")

    filename = file.filename or "upload"
    try:
        df = _read_file_to_df(filename, data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {e}")

    # Generate a SQL-safe slug
    base_slug = slugify(filename.rsplit(".", 1)[0], separator="_") or "data"
    existing = await db.execute(select(DataSource).where(DataSource.user_id == current_user.id))
    existing_slugs = {ds.slug for ds in existing.scalars().all()}
    slug = _unique_slug(base_slug, existing_slugs)

    # Store as parquet in Supabase Storage
    parquet_bytes = _df_to_parquet_bytes(df)
    source_id = uuid.uuid4()
    storage_path = f"sources/{current_user.id}/{source_id}.parquet"
    upload_file(storage_path, parquet_bytes)

    ds = DataSource(
        id=source_id,
        user_id=current_user.id,
        name=filename,
        slug=slug,
        storage_path=storage_path,
        file_type="xlsx" if filename.endswith((".xlsx", ".xls")) else "csv",
        row_count=len(df),
        column_schema=_infer_schema(df),
        size_bytes=len(data),
    )
    db.add(ds)
    await db.flush()
    await db.refresh(ds)
    return ds


@router.get("", response_model=list[DataSourceOut])
async def list_sources(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(DataSource)
        .where(DataSource.user_id == current_user.id)
        .order_by(DataSource.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{source_id}", response_model=DataSourceOut)
async def get_source(
    source_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(DataSource).where(DataSource.id == source_id, DataSource.user_id == current_user.id))
    ds = result.scalar_one_or_none()
    if not ds:
        raise HTTPException(status_code=404, detail="Data source not found")
    return ds


@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source(
    source_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(DataSource).where(DataSource.id == source_id, DataSource.user_id == current_user.id))
    ds = result.scalar_one_or_none()
    if not ds:
        raise HTTPException(status_code=404, detail="Data source not found")
    try:
        delete_file(ds.storage_path)
    except Exception:
        pass
    await db.delete(ds)
