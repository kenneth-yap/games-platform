"""Score submission and retrieval endpoints.

Game-agnostic: works for ANY registered game by looking it up in the
registry and calling the contract. This is the vertical slice tying
together the contract, the model, and the database.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.database import get_session
from app.games.registry import get_game
from app.scores.models import Score

# A router groups related endpoints; main.py will mount it onto the app.
router = APIRouter(prefix="/scores", tags=["scores"])


@router.post("/{game_name}")
def submit_score(
    game_name: str,
    raw_data: dict,
    session: Session = Depends(get_session),
) -> Score:
    """Submit a raw score for a game; validate via the contract, then store.

    Flow: look up the game → contract validates raw_data → build a Score
    → persist it → return the stored record.
    """
    # 1. Find the game. Unknown game → clear client error, not a crash.
    game = get_game(game_name)
    if game is None:
        raise HTTPException(status_code=404, detail=f"Unknown game: {game_name}")

    # 2. The CONTRACT does its job: validate and shape the raw submission.
    #    A bad payload raises ValueError, which we turn into a 400.
    try:
        value, details = game.validate_and_build(raw_data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # 3. Build the Score record from the validated result.
    #    TODO(auth): replace hardcoded user_id with the authenticated user
    #    once authentication exists. Placeholder lets us prove storage now.
    score = Score(
        user_id=1,                # ← PLACEHOLDER, replaced when auth lands
        game=game.name,
        value=value,
        details=details,
    )

    # 4. Persist via the per-request session. add → commit → refresh
    #    (refresh reloads the row so the auto-generated id/created_at
    #    are populated on the object we return).
    session.add(score)
    session.commit()
    session.refresh(score)

    return score


@router.get("/{game_name}")
def list_scores(
    game_name: str,
    session: Session = Depends(get_session),
) -> list[Score]:
    """List stored scores for a game, newest first.

    A first taste of the read path your analytics/AI layer will later use
    through its own clean interface.
    """
    statement = (
        select(Score)
        .where(Score.game == game_name)
        .order_by(Score.created_at.desc())
    )
    return list(session.exec(statement))