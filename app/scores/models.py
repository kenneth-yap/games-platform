"""The Score model — the shared, game-agnostic score record.

Mirrors the six-field schema designed on paper. ONE table serves every
game: universal columns plus a flexible `details` JSON field for
game-specific data. Adding a new game never alters this structure.
"""

from datetime import datetime, timezone
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON


def _utc_now() -> datetime:
    """Timezone-aware current time. Always store UTC; convert on display."""
    return datetime.now(timezone.utc)


class Score(SQLModel, table=True):
    """A single score record. Works identically for any game."""

    # Unique reference number for this record (the primary key).
    id: int | None = Field(default=None, primary_key=True)

    # WHO achieved it — links to a user (auth comes later).
    user_id: int = Field(index=True)

    # WHICH game produced it, e.g. "tetris". Indexed because we'll
    # frequently filter "all scores for game X".
    game: str = Field(index=True)

    # The universal headline score — the number we rank by.
    value: int

    # WHEN it happened — essential for the AI to measure improvement
    # over time. Stored UTC.
    created_at: datetime = Field(default_factory=_utc_now)

    # Flexible game-specific data, e.g. {"lines_cleared": 40, "level": 5}.
    # The DB does NOT validate its contents — that's the contract's job.
    details: dict = Field(default_factory=dict, sa_column=Column(JSON))