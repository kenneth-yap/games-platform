"""Application configuration.

The ONE place external configuration enters the system. Reads settings
from environment variables (and a local .env file in development),
never from hardcoded values. This is what lets the SAME code run
against SQLite locally and PostgreSQL in production — only the
environment differs, never the code.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Strongly-typed application settings.

    Each field is read from an environment variable of the same name
    (case-insensitive). pydantic validates types automatically — a
    malformed setting fails loudly at startup, not silently at runtime.
    """

    # The database connection string. Defaults to a local SQLite file
    # so the app runs out-of-the-box in development. In production, the
    # host (Railway) sets DATABASE_URL to its PostgreSQL connection.
    database_url: str = "sqlite:///./games_platform.db"

    # Tells pydantic to load a .env file in development. The .env is
    # git-ignored, so secrets never enter version control.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Secret key for signing JWTs. MUST be set to a long random value in
    # production (via environment). Anyone with this can forge tokens.
    jwt_secret: str = "dev-only-insecure-secret-change-in-production"

    # Origins (frontend URLs) allowed to call this API cross-origin.
    # Comma-separated in the environment; defaults to the local Vite dev
    # server. In production this becomes your Vercel domain.
    # SECURITY: list specific trusted origins, NEVER "*" with credentials.
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        """Split the comma-separated origins string into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

# A single shared settings instance, imported wherever config is needed.
# Created once at startup; the rest of the app reads from this object.
settings = Settings()