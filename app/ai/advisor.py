"""The AI advisor: fetches a user's cross-game scores, builds a prompt,
and asks Gemini for holistic improvement advice.

Uses the current Google GenAI SDK (google-genai) with a client object.
The API key comes from config (environment), never hardcoded.
"""

from google import genai
from google.genai import types
from sqlmodel import Session, select

from app.core.config import settings
from app.scores.models import Score

# The free-tier Flash model — capable enough for short advice, and free.
_MODEL = "gemini-2.5-flash"


def _summarise_scores(scores: list[Score]) -> str:
    """Turn a user's score history into a compact, TREND-AWARE summary.

    We compute concrete signals — recent average vs earlier average, best,
    most recent, and direction of change — so the AI has specific data to
    ground its advice in rather than generic platitudes.
    """
    if not scores:
        return "This player has not recorded any scores yet."

    by_game: dict[str, list[Score]] = {}
    for s in scores:
        by_game.setdefault(s.game, []).append(s)

    lines = []
    for game, gs in by_game.items():
        values = [s.value for s in gs]   # already oldest-first from the query
        n = len(values)
        best = max(values)
        recent = values[-1]

        # Trend: compare the most recent third of plays to the earliest third.
        if n >= 3:
            third = max(1, n // 3)
            early_avg = sum(values[:third]) / third
            late_avg = sum(values[-third:]) / third
            change = late_avg - early_avg
            direction = "improving" if change > 0 else "declining" if change < 0 else "flat"
            trend = (
                f"trend over last {n} plays: {direction} "
                f"(early avg {early_avg:.0f} -> recent avg {late_avg:.0f})"
            )
        else:
            trend = f"only {n} play(s) so far — not enough for a trend yet"

        lines.append(
            f"- {game}: {n} plays, best {best}, most recent {recent}, {trend}"
        )
    return "\n".join(lines)


def build_prompt(scores: list[Score]) -> str:
    """Construct a prompt that asks for a trend observation, then SHORT,
    specific advice grounded in this player's actual numbers."""
    summary = _summarise_scores(scores)
    return (
        "You are a concise gaming coach. Using ONLY this player's actual data "
        "below, respond in this exact structure:\n"
        "1. One sentence naming their current trend (cite a specific number).\n"
        "2. Exactly TWO short, specific tips that follow from that trend.\n"
        "Keep the whole reply under 60 words. Be specific to their numbers — "
        "do not give generic advice that would apply to anyone.\n\n"
        f"Player data:\n{summary}"
    )


def get_recommendation(session: Session, user_id: int) -> str:
    """Fetch the user's cross-game scores, prompt Gemini, return advice text.

    Username-scoped: only this user's scores are read (filtered by user_id).
    Game-inclusive: ALL their games, not filtered to one.
    """
    if not settings.gemini_api_key:
        # Clear, non-crashing message if the key isn't configured.
        return (
            "The AI advisor isn't configured yet (no API key set). "
            "Add GEMINI_API_KEY to enable recommendations."
        )

    # Fetch THIS user's scores across ALL games, oldest first (for trend).
    statement = (
        select(Score)
        .where(Score.user_id == user_id)
        .order_by(Score.created_at.asc())
    )
    scores = list(session.exec(statement))

    prompt = build_prompt(scores)

    client = genai.Client(api_key=settings.gemini_api_key)
    response = client.models.generate_content(
        model=_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            max_output_tokens=1000,   # hard ceiling on length
            temperature=0.7,         # a touch of variety, still focused
        ),
    )
    return response.text