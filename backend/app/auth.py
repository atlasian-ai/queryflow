import base64
import logging

import httpx
from fastapi import HTTPException, status
from jose import JWTError, jwt

from app.config import settings

logger = logging.getLogger(__name__)

_ASYMMETRIC_ALGS = {"RS256", "RS384", "RS512", "ES256", "ES384", "ES512"}
_jwks_keys: list[dict] = []


async def _load_jwks() -> list[dict]:
    global _jwks_keys
    if _jwks_keys:
        return _jwks_keys
    url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            _jwks_keys = data.get("keys", [])
            logger.info(f"Loaded {len(_jwks_keys)} JWKS key(s)")
    except Exception as exc:
        logger.warning(f"Could not load JWKS: {exc}. Will fall back to HS256 secret.")
    return _jwks_keys


def _hs256_secret() -> bytes:
    raw = settings.supabase_jwt_secret
    try:
        return base64.b64decode(raw)
    except Exception:
        return raw.encode("utf-8")


async def verify_supabase_jwt(token: str) -> dict:
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")
        kid = header.get("kid")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not parse token header: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if alg in _ASYMMETRIC_ALGS:
        keys = await _load_jwks()
        candidates = [k for k in keys if k.get("kid") == kid] if kid else keys
        if not candidates:
            candidates = keys
        if not candidates:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No JWKS keys available")

        last_exc: Exception = Exception("No keys tried")
        for key in candidates:
            try:
                return jwt.decode(token, key, algorithms=[alg], options={"verify_aud": False})
            except JWTError as exc:
                last_exc = exc

        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"{alg} verification failed: {last_exc}")

    try:
        return jwt.decode(token, _hs256_secret(), algorithms=["HS256"], options={"verify_aud": False})
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"HS256 verification failed: {exc}")


def extract_user_id(payload: dict) -> str:
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing user identifier")
    return user_id
