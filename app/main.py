"""Application entry point.

Wires the shared infrastructure to the app and exposes the API surface.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.core.database import create_db_and_tables

# CRITICAL: import every model module here so SQLModel KNOWS about the
# tables before create_db_and_tables() runs. A model SQLModel hasn't
# seen won't get a table. As you add models (users, ai_usage), import
# them here too.
from app.scores import models as _score_models  # noqa: F401
from app.scores.routes import router as scores_router

from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup/shutdown logic.

    On startup, ensure the database tables exist. This runs once when
    the server boots — the equivalent of laying the foundation before
    anyone tries to store anything in it.
    """
    create_db_and_tables()
    yield
    # (shutdown logic, if any, would go after the yield)

# The single application instance. Everything (routes, middleware,
# startup hooks) will attach to this object as the project grows.
app = FastAPI(title="Games Platform", lifespan=lifespan)
app.include_router(scores_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,  # only trusted frontend origins
    allow_credentials=True,                    # allow cookies/auth headers (needed later for auth)
    allow_methods=["*"],                       # GET, POST, etc.
    allow_headers=["*"],                       # allow all request headers
)


@app.get("/health")
def health_check() -> dict[str, str]:
    """Liveness probe — confirms the service is running."""
    return {"status": "ok"}