"""The game contract.

Defines the interface every game module MUST satisfy to plug into the
shared platform. This is the keystone of the architecture: because every
game conforms to this same shape, the shared scoring and AI code can work
with ANY game without knowing which game it is.

This is the standardised connection spec — meet it, and you drop onto the
shared infrastructure (database, AI) with zero custom adaptation.
"""

from abc import ABC, abstractmethod


class BaseGame(ABC):
    """Abstract base class that all games inherit from.

    'Abstract' means this class cannot be instantiated on its own — it is
    a specification, not a usable object. Any subclass (Tetris, TicTacToe)
    MUST implement every method marked @abstractmethod below, or Python
    refuses to let that subclass be instantiated at all.

    That refusal is the 'inspector': a game that doesn't meet the spec is
    rejected at the door, before it can cause problems at runtime.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """The game's identifier string.

        This is the value that goes into the `game` column of a score
        record (e.g. "tetris"). The shared code calls this to tag every
        score with which game produced it.
        """
        ...

    @abstractmethod
    def validate_and_build(self, raw_data: dict) -> tuple[int, dict]:
        """Validate a raw submission and shape it into a clean score.

        Takes the raw data a client sends when a playthrough ends. Each
        game implements its OWN validation rules here — this is where the
        checks the database can't perform get enforced.

        Returns a tuple of:
          - value (int): the universal headline score for ranking.
          - details (dict): the game-specific data for the `details`
            JSON field, validated and well-formed.

        Should raise an error if the submission is invalid, so bad data
        never reaches the database.
        """
        ...