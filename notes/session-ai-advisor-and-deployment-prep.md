# Session Summary — The AI Advisor & Prompt Engineering

What was built and learned in this session: a complete, working AI recommendation
feature end to end, plus the real lessons from building and debugging it.

---

## What got built this session

- **AI advisor backend**: a `/recommendations` endpoint that fetches a user's
  scores, asks Gemini for improvement advice, and returns it — authenticated,
  scoped to the user, capped per day.
- **AI advisor frontend**: a "Get advice" button (on-request only) with a daily
  quota display, wired into the game.
- **Game polish**: next-3-piece preview, hold (Shift key), fixed arrow-key page
  scrolling, advice text wrapping.

The core product is now feature-complete: playable game, accounts, stored scores,
guest play, and on-demand AI coaching.

---

## 1. Calling an external API (Gemini)

- **Calling an external API is the same pattern as the frontend calling your
  backend** — your backend becomes the "client" making an HTTP request to
  Google's servers, sending a prompt + API key, getting back generated text.
- **The API key is a secret**: it lives in the environment (`.env` locally, a real
  env var in production), read via `config.py`, NEVER hardcoded or committed.
  Anyone with the key can spend your quota.
- **Use the CURRENT library**: `google-genai` (the `google.genai` import with a
  `client = genai.Client(...)` object). The older `google-generativeai`
  (`genai.GenerativeModel(...)`) is DEPRECATED — many tutorials still show it.
  When working with fast-moving APIs, verify against current official docs.
- **Free tier reality**: Gemini Flash is free (~1,500 req/day, no card) and plenty
  capable for short advice. Pro-class models are paywalled. Free tiers prohibit
  high-volume production use and may train on your data unless you opt out.

---

## 2. Per-user rate limiting is YOUR job, not the API's

- The external API bills YOU for total usage; it has no idea who your individual
  users are. So **per-user caps are enforced in YOUR backend**, never by the API.
- **The usage-log pattern**: write one timestamped record per request (`AiUsage`
  model: id, user_id, created_at). Enforce the cap by COUNTING a user's records in
  a time window (last 24h). No counter to reset — "today's usage" is just "records
  since 24h ago." Same records-not-counters thinking as the Score table.
- **Check the cap BEFORE the expensive call**: count usage → if over limit, refuse
  with 429 → only if under, call the API and log the usage. Spend money only after
  confirming the user is allowed.
- **Defence in depth**: also set an account-level budget cap on the provider's side
  as a backstop, in case a bug bypasses your own check.

---

## 3. Prompt engineering — the real lever

This was the session's biggest practical lesson.

- **Output quality is controlled by the PROMPT, not code changes.** "Too long and
  generic" is the classic symptom of a vague prompt fed thin data.
- **Specificity comes from two things**: (a) feed the model concrete data (we
  computed an actual trend — recent third of scores vs earliest third — not just
  a flat summary), and (b) instruct it explicitly ("use ONLY this player's data",
  "cite a specific number", "do not give generic advice").
- **Control length and shape with explicit instructions**: word limits ("under 60
  words"), structure ("trend sentence, then exactly TWO tips"), forbidding fluff
  ("no preamble"), or giving a literal template to fill in.
- **Prompt-tuning is empirical and iterative** — you change the wording, run it,
  read the output, adjust. Expect several rounds. Change ONE thing at a time so you
  know which adjustment did what (same discipline as debugging).

---

## 4. The token-limit / thinking-tokens gotcha

- **`max_output_tokens` is a HARD ceiling that can truncate responses mid-sentence.**
- **Reasoning-capable models (like Gemini Flash) use hidden "thinking" tokens
  BEFORE visible output, and those count against the limit.** So a cap that seems
  generous for the visible answer can be eaten by thinking, leaving the answer
  truncated. (Symptom seen: advice cut off after one sentence at 200 tokens.)
- **The fix / rule of thumb**: set `max_output_tokens` well ABOVE what the visible
  answer needs (it's just a safety backstop), and control actual length via the
  PROMPT. Token cap and response length should be decoupled.
- **Guard against empty/truncated responses** in code: if `response.text` is empty,
  return a friendly fallback rather than a confusing fragment.

---

## 5. Debugging lessons (hard-won this session and last)

- **Read the actual error, don't guess from the symptom.** The first error you see
  is often not the ROOT error — peel them back one at a time.
- **A 400 is not a 500**: 400 = the server understood you but your DATA was invalid
  (often your own validation correctly rejecting input). 500 = the server crashed
  (read the traceback in the backend terminal). 401 = not authenticated. 429 = rate
  limited. 404 = no such endpoint. Knowing which is which points straight at the fix.
- **"Failed to fetch" = the request never connected at all** (vs a rejection). Almost
  always: the backend isn't running, or crashed on startup. Test by opening the
  backend's `/health` directly in the browser — if it loads, backend is up and the
  issue is CORS or the API URL; if not, the backend isn't running.
- **A model field has three separate parts — name, type, constraints.** An edit can
  fix one and wrongly leave the others (e.g. renaming a field but keeping the old
  type and `primary_key`). Check all three when editing a model.
- **Model vs database drift**: changing a model does NOT alter an existing table. In
  dev, delete-and-rebuild the SQLite file. In production, use migrations.

---

## 6. React rules that bit us

- **Hooks (`useState`, `useEffect`) must be called INSIDE the component function**,
  never at module top level — doing otherwise throws immediately.
- **A component returns exactly ONE root element.** Anything to be rendered must be
  nested inside it; you can't return two sibling elements. (Misplaced JSX after the
  closing `</div>` was a real bug.)
- **Capturing a key for the game usually means preventing the browser's default**
  for it (`e.preventDefault()`), or you get both behaviours — e.g. arrow keys moving
  the piece AND scrolling the page.
- **Show loading state for slow calls** (the Gemini call takes a second or two) so
  the UI doesn't appear frozen; use a `finally` block to always clear it.

---

## 7. Architecture decisions reaffirmed

- **Don't build the multi-game frontend interface before a second game exists** —
  it's scaffolding for games that don't exist yet, and its shape should be informed
  by real games, not imagined ones. The backend is ALREADY multi-game-ready by
  design; the AI advisor was built cross-game so it's forward-compatible. Build the
  frontend selector when the second game arrives.
- **Config-in-environment pays off at deployment** — the SQLite→Postgres switch,
  the API key, the CORS origins all change via environment variables, not code.

---

## Where things stand & next: DEPLOYMENT

Core product is feature-complete and on `main`. Chosen deployment path:
- **Backend** → Render (free tier: anytime deploys, free Postgres). Caveats accepted:
  free service sleeps after 15 min idle (slow first load), free DB expires in 30 days.
- **Frontend** → Vercel.

The four production changes (all via environment variables, minimal code change):
1. Database: SQLite (dev) → managed PostgreSQL (prod) via `DATABASE_URL`.
2. Secrets become real env vars on the host: `DATABASE_URL`, `JWT_SECRET` (real
   random value), `GEMINI_API_KEY`, `CORS_ORIGINS`.
3. CORS origins → the real Vercel domain.
4. Frontend `VITE_API_BASE` → the real Render backend URL.

Deployment sequence (one step verified before the next):
1. Prepare backend (config files: how to install deps, how to start the server).
2. Deploy backend to Render + Postgres; verify live `/health`.
3. Deploy frontend to Vercel pointed at live backend; verify it loads.
4. Wire CORS between the real domains; verify full flow end to end.

Remaining after deployment: logging, monitoring (the `/health` endpoint is built for it).
