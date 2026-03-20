from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


class UserSyncRequest(BaseModel):
    supabase_id: str
    email: EmailStr
    full_name: Optional[str] = None


class UserOut(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    supabase_id: UUID
    email: str
    full_name: Optional[str]
    role: str
    is_active: bool
    created_at: datetime
