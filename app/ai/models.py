"""The AiUsage model — a log of recommendation requests, for the per-user cap.

One record per request, attributed to a user with a timestamp. The cap is
enforced by COUNTING a user's records in a time window (the last 24h), so
there's no counter to reset — 'today's usage' is just 'records since 24h ago'.
Mirrors the shape of Score: id, user link, timestamp.
"""

from datetime import datetime, timezone
from sqlmodel import SQLModel, Field


def _utc_now() -> datetime:
    """Timezone-aware current time. Always store UTC."""
    return datetime.now(timezone.utc)


class AiUsage(SQLModel, table=True):
    """One recommendation request by one user, timestamped."""

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)        # WHO requested (indexed: we count per user)
    created_at: datetime = Field(default_factory=_utc_now)  # WHEN (for the 24h window)