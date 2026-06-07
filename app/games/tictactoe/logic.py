"""Tictactoe game module.

A concrete implementation of the Game contract. By inheriting `Game`
and implementing both required members, Tictactoe plugs into the shared
scores + AI infrastructure with zero changes to that shared code.

This is the contract proving its worth: the shared system never had
to learn anything Tictactoe-specific.
"""

from app.games.base import Game


class TicTacToe(Game):
    """Tictactoe, conforming to the Game contract."""

    @property
    def name(self) -> str:
        """Identifier written to the score's `game` field."""
        return "tictactoe"

    def validate_and_build(self, raw_data: dict) -> tuple[int, dict]:
        """Validate a raw Tic-tac-toe submission and shape it to the schema.

        This is where the validation the DATABASE won't do gets
        enforced. We trust nothing the client sent until checked.

        Expected raw_data shape:
            {"outcome": Win|Loss|Draw, "moves": int }

        Returns:
            (value, details) where value is the headline score and
            details is the validated game-specific dict.

        Raises:
            ValueError: if the payload is missing fields or implausible.
        """
        # --- Step 1: presence check -------------------------------------
        # Never assume the client sent what we expect. Pull each field
        # explicitly and fail loudly if absent.
        required = ("outcome", "moves")
        missing = [field for field in required if field not in raw_data]
        if missing:
            raise ValueError(f"Missing required fields: {missing}")

        outcome = raw_data["outcome"]
        moves = raw_data["moves"]

        # --- Step 2: type & sanity checks -------------------------------
        # The DB stores `details` as opaque JSON, so plausibility is OUR
        # responsibility. Reject negatives and wrong types outright.
        for field_name, field_value in ("moves", moves):
            if not isinstance(field_value, int) or field_value < 0:
                raise ValueError(
                    f"{field_name} must be a non-negative integer, "
                    f"got {field_value!r}"
                )
            
        for field_name, field_value in ("outcome", outcome):
            if not 'win' or 'lose' or 'draw':
                raise ValueError(
                    f"{field_name} must be win, lose or draw, "
                    f"got {field_value!r}"
                )

        # --- Step 3: compute the universal `value` ----------------------
        # A simple scoring rule: each cleared line is worth more at
        # higher movess. The exact formula is a game-design choice; what
        # matters architecturally is that we produce ONE integer.
        value = outcome * 100 * (moves + 1)

        # --- Step 4: build the validated details dict -------------------
        details = {
            "outcome": outcome,
            "moves": moves,
        }

        return value, details