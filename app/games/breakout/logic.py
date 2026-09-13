from app.games.base import Game


class Breakout(Game):
    @property
    def name(self) -> str:
        return "breakout"

    def validate_and_build(self, raw_data: dict) -> tuple[int, dict]:
        required = ("bricks_cleared", "level", "duration_seconds")
        missing = [f for f in required if f not in raw_data]
        if missing:
            raise ValueError(f"Missing required fields: {missing}")

        bricks_cleared = raw_data["bricks_cleared"]
        level = raw_data["level"]
        duration = raw_data["duration_seconds"]

        for field_name, field_value in (
            ("bricks_cleared", bricks_cleared),
            ("level", level),
            ("duration_seconds", duration),
        ):
            if not isinstance(field_value, int) or field_value < 0:
                raise ValueError(f"{field_name} must be a non-negative integer, got {field_value!r}")

        if level < 1:
            raise ValueError("level must be at least 1")

        value = bricks_cleared * 10 * level

        return value, {
            "bricks_cleared": bricks_cleared,
            "level": level,
            "duration_seconds": duration,
        }
