"""Guest score cleanup — runs once at server startup."""

from datetime import datetime, timedelta, timezone
from sqlmodel import Session, select

from app.core.database import engine
from app.scores.models import Score

GUEST_TTL_DAYS = 28


def cleanup_expired_guest_scores() -> int:
    """Delete guest scores older than 28 days. Returns the number deleted."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=GUEST_TTL_DAYS)
    with Session(engine) as session:
        expired = list(
            session.exec(
                select(Score)
                .where(Score.guest_id.is_not(None))
                .where(Score.created_at < cutoff)
            )
        )
        for score in expired:
            session.delete(score)
        session.commit()
    return len(expired)
