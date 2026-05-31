"""Game registry — maps a game name to its Game implementation.

This is what keeps the score endpoint game-AGNOSTIC. The endpoint looks
up a game by name and calls the contract; it never mentions Tetris (or
any specific game) directly. Adding a new game = one line here, and the
existing endpoint serves it with zero changes.
"""

from app.games.base import Game
from app.games.tetris.logic import Tetris

# The single source of truth for "which games exist". Keys are the
# identifier strings that arrive in requests and get stored in the
# Score.game column.
GAMES: dict[str, Game] = {
    "tetris": Tetris(),
    # "tictactoe": TicTacToe(),   # ← later, one line, nothing else changes
}


def get_game(name: str) -> Game | None:
    """Return the Game for `name`, or None if no such game is registered."""
    return GAMES.get(name)