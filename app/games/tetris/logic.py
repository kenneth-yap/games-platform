"""Tetris game module.

A concrete implementation of the Game contract. By inheriting `Game`
and implementing both required members, Tetris plugs into the shared
scores + AI infrastructure with zero changes to that shared code.

This is the contract proving its worth: the shared system never had
to learn anything Tetris-specific.
"""

from app.games.base import Game


class Tetris(Game):
    """Tetris, conforming to the Game contract."""

    @property
    def name(self) -> str:
        """Identifier written to the score's `game` field."""
        return "tetris"

    def validate_and_build(self, raw_data: dict) -> tuple[int, dict]:
        """Validate a raw Tetris submission and shape it to the schema.

        This is where the validation the DATABASE won't do gets
        enforced. We trust nothing the client sent until checked.

        Expected raw_data shape:
            {"lines_cleared": int, "level": int, "duration_seconds": int}

        Returns:
            (value, details) where value is the headline score and
            details is the validated game-specific dict.

        Raises:
            ValueError: if the payload is missing fields or implausible.
        """
        # --- Step 1: presence check -------------------------------------
        # Never assume the client sent what we expect. Pull each field
        # explicitly and fail loudly if absent.
        required = ("lines_cleared", "level", "duration_seconds")
        missing = [field for field in required if field not in raw_data]
        if missing:
            raise ValueError(f"Missing required fields: {missing}")

        lines = raw_data["lines_cleared"]
        level = raw_data["level"]
        duration = raw_data["duration_seconds"]

        # --- Step 2: type & sanity checks -------------------------------
        # The DB stores `details` as opaque JSON, so plausibility is OUR
        # responsibility. Reject negatives and wrong types outright.
        for field_name, field_value in (
            ("lines_cleared", lines),
            ("level", level),
            ("duration_seconds", duration),
        ):
            if not isinstance(field_value, int) or field_value < 0:
                raise ValueError(
                    f"{field_name} must be a non-negative integer, "
                    f"got {field_value!r}"
                )

        # --- Step 3: compute the universal `value` ----------------------
        # A simple scoring rule: each cleared line is worth more at
        # higher levels. The exact formula is a game-design choice; what
        # matters architecturally is that we produce ONE integer.
        value = lines * 100 * (level + 1)

        # --- Step 4: build the validated details dict -------------------
        details = {
            "lines_cleared": lines,
            "level": level,
            "duration_seconds": duration,
        }

        return value, details