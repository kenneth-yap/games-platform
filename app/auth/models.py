"""The User model — an account that can log in and own scores.

The critical field is `hashed_password`: we store the HASH, never the
password itself.
"""

from datetime import datetime, timezone
from sqlmodel import SQLModel, Field


def _utc_now() -> datetime:
    """Timezone-aware current time. Always store UTC."""
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    """A registered user. Score.user_id will point at this table's id."""

    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    hashed_password: str
    created_at: datetime = Field(default_factory=_utc_now)