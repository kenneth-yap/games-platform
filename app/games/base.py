"""The game contract.

Defines the interface every game module MUST satisfy. This is the
keystone of the multi-game architecture: shared code (scores, AI)
programs against THIS contract, never against a specific game. Any
game conforming here plugs into the shared infrastructure for free.

Mechanism: ABC (Abstract Base Class). Python refuses to instantiate
a subclass that hasn't implemented every @abstractmethod — the
runtime acts as the inspector rejecting any 'building' that doesn't
meet the connection spec.
"""

from abc import ABC, abstractmethod


class Game(ABC):
    """Abstract base every concrete game (Tetris, TicTacToe, ...) inherits.

    A subclass that fails to implement `name` or `validate_and_build`
    cannot be instantiated — the error is raised the moment you try,
    not silently at runtime later. That early failure is the point.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """The identifier string written to a score's `game` field.

        E.g. Tetris returns "tetris". This is how the shared scores
        table tags which game produced a record.
        """
        ...

    @abstractmethod
    def validate_and_build(self, raw_data: dict) -> tuple[int, dict]:
        """Check a raw client submission and shape it to the schema.

        This is where the validation the DATABASE won't do gets
        enforced (recall: the `details` JSON field is unchecked by the
        DB, so the responsibility lives here).

        Args:
            raw_data: the unverified payload sent by the game client.

        Returns:
            A (value, details) tuple:
              - value:   the universal integer score (the `value` column)
              - details: the validated game-specific dict (the `details` column)

        Raises:
            ValueError: if the submission is invalid / cannot be trusted.
        """
        ...