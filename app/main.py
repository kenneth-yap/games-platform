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


@app.get("/health")
def health_check() -> dict[str, str]:
    """Liveness probe — confirms the service is running."""
    return {"status": "ok"}