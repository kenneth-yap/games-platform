"""Score submission and retrieval endpoints."""

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlmodel import Session, select

from app.core.database import get_session
from app.games.registry import get_game
from app.scores.models import Score

from app.auth.dependencies import get_optional_user
from app.auth.models import User

router = APIRouter(prefix="/scores", tags=["scores"])


@router.post("/{game_name}")
def submit_score(
    game_name: str,
    raw_data: dict,
    session: Session = Depends(get_session),
    current_user: User | None = Depends(get_optional_user),
    x_guest_id: str | None = Header(default=None),
) -> Score:
    """Submit a score for a game. Works for both authenticated users and guests.

    Authenticated: pass Authorization: Bearer <token>.
    Guest: pass X-Guest-ID: <uuid>. Guest scores auto-delete after 28 days.
    """
    if current_user is None and not x_guest_id:
        raise HTTPException(status_code=400, detail="Provide Authorization or X-Guest-ID header.")

    game = get_game(game_name)
    if game is None:
        raise HTTPException(status_code=404, detail=f"Unknown game: {game_name}")

    try:
        value, details = game.validate_and_build(raw_data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    score = Score(
        user_id=current_user.id if current_user else None,
        guest_id=None if current_user else x_guest_id,
        game=game.name,
        value=value,
        details=details,
    )

    session.add(score)
    session.commit()
    session.refresh(score)

    return score


@router.get("/{game_name}")
def list_scores(
    game_name: str,
    session: Session = Depends(get_session),
) -> list[Score]:
    """List stored scores for a game, newest first."""
    statement = (
        select(Score)
        .where(Score.game == game_name)
        .order_by(Score.created_at.desc())
    )
    return list(session.exec(statement))
