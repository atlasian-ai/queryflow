"""Supabase Storage helpers — upload, download, signed URLs."""
import io
import logging
from typing import Optional

from supabase import create_client, Client

from app.config import settings

logger = logging.getLogger(__name__)

_client: Optional[Client] = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _client


def upload_file(path: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    """Upload bytes to Supabase Storage. Returns the storage path."""
    sb = get_supabase()
    sb.storage.from_(settings.supabase_storage_bucket).upload(
        path=path,
        file=data,
        file_options={"content-type": content_type, "upsert": "true"},
    )
    return path


def download_file(path: str) -> bytes:
    """Download a file from Supabase Storage."""
    sb = get_supabase()
    return sb.storage.from_(settings.supabase_storage_bucket).download(path)


def get_signed_url(path: str, expires_in: int = 3600) -> str:
    """Get a signed download URL."""
    sb = get_supabase()
    result = sb.storage.from_(settings.supabase_storage_bucket).create_signed_url(path, expires_in)
    return result["signedURL"]


def delete_file(path: str) -> None:
    sb = get_supabase()
    sb.storage.from_(settings.supabase_storage_bucket).remove([path])
