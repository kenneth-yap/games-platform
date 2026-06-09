# Games Platform — What I've Learned So Far

A running summary of the concepts and skills built while developing a full-stack
games platform (FastAPI backend + React frontend), from zero to a working,
authenticated, score-storing application.

---

## The big picture: what's been built

A full-stack web application with these working layers:
- A **backend API** (FastAPI) with a health check, score submission/retrieval, and authentication.
- A **shared database** (SQLite in dev, designed for PostgreSQL in production).
- A **game-agnostic architecture** — one backend serves many games via a contract.
- A **React frontend** that plays Tetris and talks to the backend across origins.
- **Authentication** (backend done): username + password, hashed, with JWT tokens.

Still to do: frontend auth wiring, the AI advisor, deployment, logging, monitoring, storage.

---

## 1. Git & version control (the workflow discipline)

- **Git as a record of intent**, not just backup. Commit messages are documentation,
  written in the imperative ("Add health endpoint").
- **`.gitignore` before the first commit** — secrets (`.env`), environments (`.venv/`,
  `node_modules/`), and local data (`*.db`) must NEVER enter version control.
- **The branch-and-PR workflow** (the core rhythm):
  `branch -> work -> commit -> push -> PR -> review the diff -> merge -> return to main`.
- **`main` must always be deployable.** Never commit directly to it. Feature work lives
  on `feature/...` branches until verified, then merges via a Pull Request.
- **Commit + push often (it's just saving); merge only when done and verified.**
- **Observe before acting** when something breaks: `git status`, `git remote -v`,
  `git branch -a` show the real state. Diagnose, then fix.
- Problems solved along the way: SSH-vs-HTTPS remote mismatch, missing upstream
  tracking, wrong default branch on GitHub. (All captured in the Git cheatsheet.)

---

## 2. Project structure & architecture principles

- **Separation of concerns**: each folder is one concern (`core/`, `games/`, `scores/`,
  `auth/`). Code lives in `app/`, not loose in the root.
- **Dependencies point ONE way — toward the foundation** (`core/`). Nothing in `core/`
  reaches "up" into the things that use it. This keeps the structure sound as it grows.
- **The walking skeleton**: build something deployable and inspectable FIRST (the
  `/health` endpoint), before any features. Verify each layer before building on it.
- **Modular monolith over premature microservices**: one well-structured backend with
  clean internal seams. Split into services only when a real pressure forces it.
- **Build a clean seam, defer the heavy machinery** (e.g. analytics reads through its
  own interface now; a real data pipeline/warehouse only if scale ever demands it).

---

## 3. The multi-game design (the contract pattern)

- **The contract (`games/base.py`)** — an Abstract Base Class (ABC) that every game MUST
  implement. Python REFUSES to instantiate a game that doesn't conform — the runtime is
  the inspector rejecting any "building" that doesn't meet the connection spec.
- **Program to an interface, not an implementation**: shared code (scores, AI) works on
  ANY game via the contract, never against a specific game.
- **The registry (`games/registry.py`)** maps a game name -> its implementation, keeping
  the score endpoint game-agnostic. Adding a new game = one line + a new module.
- **Design data on paper first** — the interfaces fall out of the data shape once it's clear.

---

## 4. The database

- **One game-agnostic `Score` table**: universal columns (`id`, `user_id`, `game`,
  `value`, `created_at`) + a flexible `details` JSON field for game-specific data. The
  table structure never changes when a new game is added.
- **The cost of JSON flexibility**: the DB won't validate `details` contents — that
  validation responsibility moves UP into the contract.
- **`index=True`** on fields you search by (a tabbed divider in the filing cabinet).
- **Always store UTC**; convert on display.
- **Sessions**: each request gets a fresh, short-lived database session (check out the
  records room, do the task, sign off, leave).
- **The #1 trap**: SQLModel only creates tables for models it has SEEN imported — import
  every model in `main.py` or you get silent "no such table" errors.
- **Models vs the built database are separate**: changing a model does NOT alter an
  existing table. In dev, delete-and-rebuild the db. In production, use migrations (Alembic).

---

## 5. APIs & how the pieces connect

- **An API is named entry points other programs can call** — like labelled service
  connection points on a building. You define the doors; the framework handles HTTP.
- **The routing chain is all explicit links you wrote**: `include_router` (app -> router),
  the `@router.post` decorator (URL -> function), and `import`s (function -> other modules).
  No magic — every connection is a line of code.
- **A backend API has no homepage**: visiting `/` returns "Not Found" (404) by default,
  and that's correct — it only answers at endpoints you defined.
- **HTTP status codes**: 404 = no such endpoint (harmless); 500 = endpoint ran but crashed
  (a real bug — read the traceback in the server terminal, not the browser).

---

## 6. Frontend & the frontend/backend split

- **Two separate programs** on different origins (frontend :5173, backend :8000) that
  communicate ONLY over HTTP. They share no memory — the frontend sends a request and
  waits for a reply; it never calls a backend function directly.
- **`scores.js` is the single doorway**: all API calls flow through it, so changes (the
  API URL, auth headers) happen in ONE place.
- **CORS**: browsers block cross-origin calls by default. The backend must explicitly
  permit trusted origins (security desk issuing a standing instruction). Configured in
  `main.py`, with allowed origins from `config.py`. NEVER use `"*"` — list specific origins.
- **Config in the environment, both sides**: backend reads `DATABASE_URL`, `CORS_ORIGINS`,
  `JWT_SECRET` from the environment; frontend reads `VITE_API_BASE`. Same code runs locally
  and in production — only the environment differs, never the code.

---

## 7. Authentication (backend complete)

- **Authentication (who you are) vs authorization (what you're allowed to do).**
- **NEVER store passwords** — store a one-way **hash** (bcrypt). At login, re-hash the
  submitted password and COMPARE; the original is never stored or recovered. (Like keeping
  a fingerprint, not a sample.) bcrypt adds salting + deliberate slowness automatically.
- **JWT tokens** keep users logged in statelessly: on login the backend issues a SIGNED
  token (a tamper-proof wristband). Every request carries it; the backend verifies the
  signature using a secret key only it knows. Tampered/expired tokens are rejected.
- **The JWT secret is the master key** — protect it (environment, never committed).
- **`get_current_user` dependency**: protected endpoints add `Depends(get_current_user)`;
  it reads the token, verifies it, loads the user. This replaced the `user_id=1` placeholder.
- **Vague login errors on purpose** ("incorrect username or password" for both cases) so
  attackers can't probe which usernames exist.
- **Design choices made**: username + password (data minimisation; no email = smaller leak
  surface, but no password recovery). Guest play allowed — playing needs no account, only
  SAVING a score requires login.
- **Key insight**: the defence against a catastrophic credential leak is the HASHING, not
  the choice of identifier. Get password handling right and a leak is embarrassing, not fatal.

---

## 8. Tooling & environment (Windows / PowerShell)

- **Shell commands differ by OS; tool commands don't.** File creation, paths, activating
  environments differ (PowerShell vs Mac/Linux). `git`, `pip`, `uvicorn`, `docker`,
  `python` are the same everywhere (the tool interprets them, not the OS).
- **Virtual environments** (`.venv`) isolate a project's Python packages. `node_modules`
  is the JavaScript equivalent. Commit the *materials list* (`requirements.txt`,
  `package.json`), never the *installed materials*.
- **`python -m pip install ...`** guarantees the package lands in the Python that's running.
- **Reading errors is the core skill**: a `SyntaxError` on a quote usually means the shell
  mangled the command (move it to a file). A `datatype mismatch` / `no such table` usually
  means model and database disagree. The FIRST error is often not the ROOT error — peel
  them back one at a time.
- **VS Code navigation**: Go to Definition (`F12`) jumps to where something is defined;
  Find All References (`Shift+F12`) shows everywhere it's used — answers "what gets used where".
- **Read the imports at the top of a file** — they ARE the file's dependency list.

---

## 9. Recurring mental models (the transferable lessons)

1. **Skeleton that deploys/inspects first; features after.**
2. **Design data on paper before code** — interfaces follow from the data shape.
3. **Config in the environment, never hardcoded.**
4. **One contract (interface) so shared code works on any implementation.**
5. **Dependencies point one way, toward the stable foundation.**
6. **Verify each layer works before building the next on top of it.**
7. **Every layer shipped through a branch + PR.**
8. **Commit/push to save; merge only when verified.**
9. **A field has three separate parts — name, type, constraints — check all three when editing.**
10. **Models and the built database are different things; keep them in sync deliberately.**

---

## Where things stand & what's next

**Done & on `main`:** skeleton, contract, database, score API, React frontend + CORS, playable Tetris.
**Done but UNMERGED (branch `feature/authentication`, not yet fully verified):** backend auth.

**Resume plan:**
1. Verify the full auth flow in `/docs` (guest block 401 -> login -> authorized submission).
2. Merge the auth branch.
3. Wire frontend auth (4 pieces): token storage + attachment in `scores.js`, register/login
   functions, a login form component, logged-in state + guest "sign in to save" nudge.
4. Then: the AI advisor (per-user Gemini cap via a usage log), deployment, logging, monitoring, storage.
