from app.games.base import Game


class Snake(Game):
    @property
    def name(self) -> str:
        return "snake"

    def validate_and_build(self, raw_data: dict) -> tuple[int, dict]:
        required = ("snake_length", "duration_seconds")
        missing = [f for f in required if f not in raw_data]
        if missing:
            raise ValueError(f"Missing required fields: {missing}")

        snake_length = raw_data["snake_length"]
        duration = raw_data["duration_seconds"]

        for field_name, field_value in (
            ("snake_length", snake_length),
            ("duration_seconds", duration),
        ):
            if not isinstance(field_value, int) or field_value < 0:
                raise ValueError(f"{field_name} must be a non-negative integer, got {field_value!r}")

        if snake_length < 1:
            raise ValueError("snake_length must be at least 1")

        foods_eaten = max(0, snake_length - 3)
        value = foods_eaten * 100

        return value, {
            "snake_length": snake_length,
            "foods_eaten": foods_eaten,
            "duration_seconds": duration,
        }
