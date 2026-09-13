from app.games.base import Game


class Asteroids(Game):
    @property
    def name(self) -> str:
        return "asteroids"

    def validate_and_build(self, raw_data: dict) -> tuple[int, dict]:
        required = ("asteroids_destroyed", "level", "duration_seconds")
        missing = [f for f in required if f not in raw_data]
        if missing:
            raise ValueError(f"Missing required fields: {missing}")

        asteroids_destroyed = raw_data["asteroids_destroyed"]
        level = raw_data["level"]
        duration = raw_data["duration_seconds"]

        for field_name, field_value in (
            ("asteroids_destroyed", asteroids_destroyed),
            ("level", level),
            ("duration_seconds", duration),
        ):
            if not isinstance(field_value, int) or field_value < 0:
                raise ValueError(f"{field_name} must be a non-negative integer, got {field_value!r}")

        if level < 1:
            raise ValueError("level must be at least 1")

        value = asteroids_destroyed * 50 * level

        return value, {
            "asteroids_destroyed": asteroids_destroyed,
            "level": level,
            "duration_seconds": duration,
        }
