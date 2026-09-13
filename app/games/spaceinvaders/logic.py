from app.games.base import Game


class SpaceInvaders(Game):
    @property
    def name(self) -> str:
        return "spaceinvaders"

    def validate_and_build(self, raw_data: dict) -> tuple[int, dict]:
        required = ("aliens_killed", "level", "duration_seconds")
        missing = [f for f in required if f not in raw_data]
        if missing:
            raise ValueError(f"Missing required fields: {missing}")

        aliens_killed = raw_data["aliens_killed"]
        level = raw_data["level"]
        duration = raw_data["duration_seconds"]

        for field_name, field_value in (
            ("aliens_killed", aliens_killed),
            ("level", level),
            ("duration_seconds", duration),
        ):
            if not isinstance(field_value, int) or field_value < 0:
                raise ValueError(f"{field_name} must be a non-negative integer, got {field_value!r}")

        if level < 1:
            raise ValueError("level must be at least 1")

        value = aliens_killed * 15 * level

        return value, {
            "aliens_killed": aliens_killed,
            "level": level,
            "duration_seconds": duration,
        }
