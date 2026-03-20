import uuid
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserOut, UserSyncRequest

router = APIRouter()


@router.post("/sync", response_model=UserOut)
async def sync_user(payload: UserSyncRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.supabase_id == uuid.UUID(payload.supabase_id)))
    user = result.scalar_one_or_none()

    if user:
        if payload.full_name and user.full_name != payload.full_name:
            user.full_name = payload.full_name
        return user

    count_result = await db.execute(select(User))
    is_first = len(count_result.scalars().all()) == 0

    user = User(
        supabase_id=uuid.UUID(payload.supabase_id),
        email=payload.email,
        full_name=payload.full_name,
        role="admin" if is_first else "member",
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
