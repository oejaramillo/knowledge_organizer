import os
from pathlib import Path

from dotenv import load_dotenv

# Navigate from board/backend/core/config.py up to the project root
# config.py -> core -> backend -> board -> root
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
ENV_PATH = ROOT_DIR / ".env"

# Load the environment variables from the project root
load_dotenv(dotenv_path=ENV_PATH)

# Origins allowed to call the API when CORS_ORIGINS is not configured.
# 5173 is the Vite dev server, 3000 is a common React port.
DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]


def _parse_cors_origins() -> list[str]:
    """Read CORS_ORIGINS ("*" or a comma-separated list) from the environment."""
    raw = (os.getenv("CORS_ORIGINS") or "").strip()
    if not raw:
        return list(DEFAULT_CORS_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def _env_flag(name: str, default: bool = False) -> bool:
    raw = (os.getenv(name) or "").strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "on"}


class Settings:
    PROJECT_TITLE: str = "Research Board API"
    DATABASE_URL: str | None = os.getenv("DATABASE_URL")
    CORS_ORIGINS: list[str] = _parse_cors_origins()

    # ── Authentication (opt-in) ─────────────────────────────────────────────
    # The API is meant to run on the loopback interface for a single user, so
    # no token is required by default. Set API_AUTH_ENABLED=true (plus
    # API_TOKEN and the frontend's VITE_API_TOKEN) before binding the API to a
    # non-loopback address.
    API_AUTH_ENABLED: bool = _env_flag("API_AUTH_ENABLED", False)
    API_TOKEN: str | None = (os.getenv("API_TOKEN") or "").strip() or None

    @property
    def cors_allow_credentials(self) -> bool:
        """Credentials are only valid together with an explicit origin list.

        Browsers reject ``Access-Control-Allow-Origin: *`` on credentialed
        requests, and this API is token/cookie-less, so a wildcard origin is
        served without credentials.
        """
        return "*" not in self.CORS_ORIGINS


settings = Settings()
