"""Database infrastructure — the shared connection every part uses.

Site infrastructure: depends on `config` below it, and on nothing above
it. Games, scores, auth all import FROM here; this knows nothing of them.
"""

from collections.abc import Generator
from sqlmodel import SQLModel, Session, create_engine

from app.core.config import settings

# The engine: the app's single pool of connections to the database.
# Created once at startup and reused. `echo=False` keeps logs quiet;
# flip to True temporarily to SEE the SQL being run (useful for learning).
#
# connect_args is a SQLite-only quirk: SQLite by default forbids use
# across threads, which a web server needs. Harmless to set; PostgreSQL
# ignores it. We only apply it when actually using SQLite.
_connect_args = (
    {"check_same_thread": False}
    if settings.database_url.startswith("sqlite")
    else {}
)

engine = create_engine(settings.database_url, echo=False, connect_args=_connect_args)


def create_db_and_tables() -> None:
    """Create all tables defined by SQLModel models that have been imported.

    IMPORTANT: a model only gets a table if its module has been imported
    before this runs — SQLModel can only create what it knows about. We
    handle that in the startup wiring (Piece 3).
    """
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """Yield a fresh database session for ONE unit of work (one request).

    Opened per-request, closed when done — the 'check out the records
    room, do your task, sign off, leave' pattern. The `yield` + `with`
    guarantees the session is always closed, even if the request errors.
    Used as a FastAPI dependency so endpoints get a session injected.
    """
    with Session(engine) as session:
        yield session