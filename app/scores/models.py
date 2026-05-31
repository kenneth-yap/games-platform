"""The score data model.

One model serves ALL games — the universal fields are columns, and the
per-game variation lives in the flexible `details` field. Adding a new
game NEVER requires changing this table.

Mirrors the schema designed on paper:
  id, user_id, game, value, created_at, details
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class Score:
    """A single score record, game-agnostic.

    For now this is a plain in-memory dataclass — a clean Python
    representation of the schema. When we add the database later, this
    maps directly onto a database table with the same fields, so the
    shape we commit to now is the shape we persist later.
    """

    user_id: str          # WHO — links to a user (auth comes later)
    game: str             # WHICH game, e.g. "tetris" — from BaseGame.name
    value: int            # the universal headline score, for ranking
    details: dict = field(default_factory=dict)  # game-specific JSON data

    # WHEN — defaults to "now" in UTC if not supplied. Always store time
    # in UTC; convert to local only for display. Mixing timezones in
    # storage is a classic, painful bug.
    created_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    # The unique id is deliberately omitted for now — the database will
    # generate it automatically when we add persistence. Inventing our
    # own id scheme before then would be premature.