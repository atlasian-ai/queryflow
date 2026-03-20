import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import AsyncSessionLocal
from app.routers import auth as auth_router
from app.routers import sources as sources_router
from app.routers import pipelines as pipelines_router
from app.routers import runs as runs_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Warming up database connection pool...")
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        logger.info("Database ready.")
    except Exception as exc:
        logger.warning(f"DB warm-up failed: {exc}")

    from app.auth import _load_jwks
    await _load_jwks()

    yield


app = FastAPI(
    title="QueryFlow API",
    description="Visual SQL pipeline builder with AI-powered SQL generation",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router, prefix="/auth", tags=["auth"])
app.include_router(sources_router.router, prefix="/sources", tags=["sources"])
app.include_router(pipelines_router.router, prefix="/pipelines", tags=["pipelines"])
app.include_router(runs_router.router, prefix="/pipelines", tags=["runs"])


@app.get("/health")
async def health_check():
    return {"status": "ok"}
