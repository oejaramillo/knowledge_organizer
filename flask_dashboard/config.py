"""Application configuration loaded from environment variables."""
import os

from dotenv import load_dotenv

load_dotenv()


class Config:
    # Database connection string (used by db.py via DATABASE_URL too)
    DATABASE_URL = os.getenv("DATABASE_URL")

    # Token required for all write endpoints (POST/PATCH/DELETE).
    # Sent by the client as `Authorization: Bearer <token>` or `X-API-Token`.
    API_TOKEN = os.getenv("API_TOKEN")

    # Optional default contributor recorded in the change_log for writes.
    # Empty string -> None so it casts cleanly to a nullable UUID column.
    DEFAULT_CONTRIBUTOR_ID = os.getenv("DEFAULT_CONTRIBUTOR_ID") or None

    # CORS: comma separated list of allowed origins, or "*" for all.
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")

    # Pagination
    DEFAULT_PER_PAGE = 25
    MAX_PER_PAGE = 250

    # Server
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", "3000"))
    DEBUG = os.getenv("FLASK_DEBUG", "0") == "1"
