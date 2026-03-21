"""Folder CRUD endpoints."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.pipeline import PipelineFolder
from app.schemas.pipeline import FolderCreate, FolderUpdate, FolderOut

router = APIRouter()


@router.get("", response_model=list[FolderOut])
async def list_folders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PipelineFolder)
        .where(PipelineFolder.user_id == current_user.id)
        .order_by(PipelineFolder.name)
    )
    return result.scalars().all()


@router.post("", response_model=FolderOut, status_code=status.HTTP_201_CREATED)
async def create_folder(
    payload: FolderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    folder = PipelineFolder(
        user_id=current_user.id,
        name=payload.name,
        emoji=payload.emoji,
    )
    db.add(folder)
    await db.flush()
    await db.refresh(folder)
    return folder


@router.put("/{folder_id}", response_model=FolderOut)
async def update_folder(
    folder_id: uuid.UUID,
    payload: FolderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    folder = await _get_owned_folder(folder_id, current_user, db)
    if payload.name is not None:
        folder.name = payload.name
    if payload.emoji is not None:
        folder.emoji = payload.emoji
    await db.flush()
    await db.refresh(folder)
    return folder


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(
    folder_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    folder = await _get_owned_folder(folder_id, current_user, db)
    await db.delete(folder)


async def _get_owned_folder(folder_id: uuid.UUID, user: User, db: AsyncSession) -> PipelineFolder:
    result = await db.execute(
        select(PipelineFolder).where(PipelineFolder.id == folder_id, PipelineFolder.user_id == user.id)
    )
    folder = result.scalar_one_or_none()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    return folder
