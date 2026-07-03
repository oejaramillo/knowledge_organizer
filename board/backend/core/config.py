import os
from pathlib import Path
from dotenv import load_dotenv

# Navigate from board/backend/core/config.py up to the project root
# config.py -> core -> backend -> board -> root
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
ENV_PATH = ROOT_DIR / ".env"

# Load the environment variables from the project root
load_dotenv(dotenv_path=ENV_PATH)

class Settings:
    PROJECT_TITLE: str = "Research Board API"
    # Fallback to localhost if not found, but it should grab the Neon URL
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL"
    )

settings = Settings()