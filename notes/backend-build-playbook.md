# Backend Build Playbook

A reproducible recipe for the backend pattern built so far: a game-agnostic,
multi-game scores platform with a clean contract, shared database, and an API.

Stack: **Python + FastAPI + SQLModel + SQLite (dev) / PostgreSQL (prod)**.
Commands shown for **Windows PowerShell**.

The order matters as much as the code. Build the skeleton that can be
inspected and deployed *before* it does anything useful, then add layers.

---

## The architecture in one picture

```
games-platform/
├── app/                      # THE BACKEND (one service, modular inside)
│   ├── main.py               # front door: wires routers, runs startup
│   ├── core/                 # SHARED INFRASTRUCTURE (depends on nothing above)
│   │   ├── config.py         #   settings read from environment
│   │   └── database.py       #   engine, per-request session, table creation
│   ├── games/                # PER-GAME MODULES behind a contract
│   │   ├── base.py           #   THE CONTRACT (abstract base class)
│   │   ├── registry.py       #   maps "tetris" -> game implementation
│   │   └── tetris/logic.py   #   one concrete game
│   └── scores/               # SCORES (game-agnostic)
│       ├── models.py         #   ONE Score table for ALL games
│       └── routes.py         #   submit + list endpoints
└── (root: .gitignore, .env, requirements.txt, README.md)
```

Key principles:
- The client never talks to the database directly — only via the API.
- `core/` is shared infrastructure; everything depends on it, it depends on nothing above.
- Dependencies point ONE way, toward the foundation. Never the reverse.
- One scores table serves every game (universal columns + flexible JSON `details`).
- A contract (abstract base class) forces every game into the same shape,
  so shared code (scores, AI) works on any game without knowing which.

---

## Phase 0 — Project skeleton

```powershell
mkdir games-platform
cd games-platform
git init

python -m venv .venv
.venv\Scripts\Activate.ps1        # prompt should show (.venv)
```

Create `.gitignore` BEFORE first commit so secrets never enter history:
```
__pycache__/
*.pyc
.venv/
.env
*.log
*.db
.DS_Store
```

Dependencies (`requirements.txt`):
```
fastapi
uvicorn[standard]
sqlmodel
pydantic-settings
python-dotenv
```

```powershell
pip install -r requirements.txt
pip freeze > requirements.txt    # pin exact versions for reproducibility
```

---

## Phase 1 — Walking skeleton (health check)

`app/main.py` (minimal first version):
```python
from fastapi import FastAPI

app = FastAPI(title="Games Platform")

@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
```

Run and verify BEFORE building features:
```powershell
uvicorn app.main:app --reload
```
Visit `http://127.0.0.1:8000/health` -> `{"status":"ok"}`.
Visit `http://127.0.0.1:8000/docs` -> interactive API docs (free with FastAPI).

> Health endpoint FIRST: it's the inspection port every monitoring tool,
> load balancer, and deploy platform will call. Observability is foundational,
> not bolted on.

---

## Phase 2 — Design the data ON PAPER first

Six fields, fixed forever, serving every game:

| Field        | Type      | Role                                    |
|--------------|-----------|-----------------------------------------|
| `id`         | unique ID | primary key                             |
| `user_id`    | reference | WHO (links to user; auth later)         |
| `game`       | text      | WHICH game ("tetris")                   |
| `value`      | integer   | universal headline score                |
| `created_at` | timestamp | WHEN (essential for trend analytics)    |
| `details`    | JSON      | game-specific data, flexible contents   |

> The `details` JSON is the trick: the COLUMN is universal, the CONTENTS vary
> per game. Adding a game never changes the table. Cost: the DB won't validate
> `details` contents — that responsibility moves UP into the contract.

---

## Phase 3 — The contract (keystone)

`app/games/base.py`:
```python
from abc import ABC, abstractmethod

class Game(ABC):
    @property
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    def validate_and_build(self, raw_data: dict) -> tuple[int, dict]: ...
```

> ABC + @abstractmethod = enforcement. A subclass missing either member
> CANNOT be instantiated — Python raises the moment you try. The runtime is
> the inspector rejecting any game that doesn't meet the connection spec.
> Keep the contract MINIMAL: only what must be uniform.

---

## Phase 4 — The Score model

`app/scores/models.py`:
```python
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON

def _utc_now() -> datetime:
    return datetime.now(timezone.utc)

class Score(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    game: str = Field(index=True)
    value: int
    created_at: datetime = Field(default_factory=_utc_now)
    details: dict = Field(default_factory=dict, sa_column=Column(JSON))
```

> `index=True` on fields you SEARCH by (a tabbed divider in the filing cabinet).
> Always store UTC; convert on display.

---

## Phase 5 — Database infrastructure

`app/core/config.py`:
```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "sqlite:///./games_platform.db"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
```

`app/core/database.py`:
```python
from collections.abc import Generator
from sqlmodel import SQLModel, Session, create_engine
from app.core.config import settings

_connect_args = (
    {"check_same_thread": False}
    if settings.database_url.startswith("sqlite") else {}
)
engine = create_engine(settings.database_url, echo=False, connect_args=_connect_args)

def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)

def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
```

> Config comes from the ENVIRONMENT, never hardcoded. Same code runs against
> SQLite locally and PostgreSQL in production — only `DATABASE_URL` differs.
> A session = one short conversation with the DB per request; opened and closed
> per unit of work.

---

## Phase 6 — Wire database into startup (`app/main.py`)

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.core.database import create_db_and_tables

# CRITICAL: import every model module so SQLModel KNOWS the tables exist
# before create_db_and_tables() runs. Forgetting this = silent "no such table".
from app.scores import models as _score_models  # noqa: F401

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield

app = FastAPI(title="Games Platform", lifespan=lifespan)

@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
```

> The model-import-for-side-effect is the #1 beginner trap. SQLModel only
> creates tables for models it has SEEN imported. Import every model here.

---

## Phase 7 — Game registry + endpoints

`app/games/registry.py`:
```python
from app.games.base import Game
from app.games.tetris.logic import Tetris

GAMES: dict[str, Game] = {
    "tetris": Tetris(),
    # "tictactoe": TicTacToe(),   # later: one line, nothing else changes
}

def get_game(name: str) -> Game | None:
    return GAMES.get(name)
```

`app/scores/routes.py`:
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.core.database import get_session
from app.games.registry import get_game
from app.scores.models import Score

router = APIRouter(prefix="/scores", tags=["scores"])

@router.post("/{game_name}")
def submit_score(game_name: str, raw_data: dict,
                 session: Session = Depends(get_session)) -> Score:
    game = get_game(game_name)
    if game is None:
        raise HTTPException(status_code=404, detail=f"Unknown game: {game_name}")
    try:
        value, details = game.validate_and_build(raw_data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    score = Score(user_id=1, game=game.name, value=value, details=details)
    # TODO(auth): replace hardcoded user_id with the authenticated user
    session.add(score); session.commit(); session.refresh(score)
    return score

@router.get("/{game_name}")
def list_scores(game_name: str,
                session: Session = Depends(get_session)) -> list[Score]:
    statement = (select(Score).where(Score.game == game_name)
                 .order_by(Score.created_at.desc()))
    return list(session.exec(statement))
```

Mount the router in `app/main.py`:
```python
from app.scores.routes import router as scores_router
app.include_router(scores_router)
```

> The endpoint is GAME-AGNOSTIC: it looks the game up in the registry and calls
> the contract. It never names a specific game. Adding tic-tac-toe = register
> it + write its module; the endpoint is untouched.

---

## How a request flows (the whole point)

```
POST /scores/tetris
  -> main.py (front door)
  -> include_router        (link: app -> scores router)
  -> @router.post pattern  (link: URL -> function)
  -> imports               (links: function -> registry, model, database)
  -> get_game("tetris")    (link: string -> Tetris code)
  -> contract validates -> Score built -> session stores -> response
```
Every arrow is an explicit line you wrote: `include_router`, a decorator,
or an `import`. No magic. Dependencies flow one way, toward `core/`.

---

## Verify the whole slice (via /docs)

1. `POST /scores/tetris` with `{"lines_cleared": 40, "level": 5, "duration_seconds": 180}`
   -> returns a Score with `value: 30000`.
2. `POST /scores/tetris` with negative lines -> `400` (contract rejects it).
3. `POST /scores/chess` -> `404` (unknown game).
4. `GET /scores/tetris` -> lists submitted scores.

Seeing the REJECTIONS work matters as much as the happy path — it proves the
validation gate is real.

---

## Still TODO (not yet built)

- Authentication (real users; replaces the hardcoded `user_id=1`)
- AI advisor + per-user usage cap (a usage LOG, counted per time window)
- Deployment (backend -> Railway/Render + Postgres; frontend -> Vercel)
- CORS config (when a separate-origin frontend calls the API)
- Logging, monitoring, object storage

---

## The transferable lessons (the real takeaway)

1. Skeleton that deploys/inspects FIRST; features after.
2. Design data on paper before code — interfaces fall out of the data shape.
3. Config in the environment, never hardcoded.
4. One contract (interface) so shared code works on any implementation.
5. Dependencies point one way, toward the stable foundation.
6. Verify each layer works before building the next on top of it.
7. Every layer shipped through a branch + PR (see the Git cheatsheet).
