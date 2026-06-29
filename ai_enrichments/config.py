import os
from dotenv import load_dotenv

load_dotenv()

# ── Provider defaults ──────────────────────────────────────────────────────────
DEEPSEEK_API_KEY  = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
DEEPSEEK_MODEL    = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

OPENAI_API_KEY    = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL      = os.getenv("OPENAI_MODEL", "gpt-4o")

# ── Enrichment behaviour ───────────────────────────────────────────────────────
# Max PDF characters sent in full-text mode (≈ 120k tokens safety margin)
MAX_PDF_CHARS = 400_000

# How many claims to request per paper
MAX_CLAIMS = 8

# Temperature — low for structured extraction
AI_TEMPERATURE = 0.2