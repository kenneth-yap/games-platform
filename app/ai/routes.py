"""The recommendation endpoint: protected, capped, on-request.

Flow: authenticated user -> check daily cap -> if under, generate advice
and log the usage -> return it. The expensive Gemini call only happens
AFTER the cap check passes.
"""

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.config import settings
from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.ai.models import AiUsage
from app.ai.advisor import get_recommendation

router = APIRouter(prefix="/recommendations", tags=["ai"])


@router.post("")
def get_advice(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Generate a holistic recommendation for the logged-in user.

    Protected (needs login -> username scoping is automatic). Capped at
    settings.ai_daily_limit requests per user per rolling 24 hours.
    """
    # Count this user's requests in the last 24 hours.
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    used = session.exec(
        select(func.count(AiUsage.id)).where(
            AiUsage.user_id == current_user.id,
            AiUsage.created_at >= since,
        )
    ).one()

    if used >= settings.ai_daily_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily limit of {settings.ai_daily_limit} recommendations reached. Try again tomorrow.",
        )

    # Under the cap: generate advice (the expensive call), then log usage.
    advice = get_recommendation(session, current_user.id)

    session.add(AiUsage(user_id=current_user.id))
    session.commit()

    return {"advice": advice, "used_today": used + 1, "daily_limit": settings.ai_daily_limit}