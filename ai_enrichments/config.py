# ============================================================================
# AI ENRICHMENT PIPELINE - CONFIGURATION
# ============================================================================
# This file contains all configuration constants and environment variable
# loading for the AI enrichment pipeline. It centralizes settings for
# multiple AI providers and processing behavior.
#
# ENVIRONMENT VARIABLES REQUIRED:
# - DEEPSEEK_API_KEY: API key for DeepSeek AI service
# - OPENAI_API_KEY: API key for OpenAI GPT models
#
# OPTIONAL ENVIRONMENT VARIABLES:
# - DEEPSEEK_BASE_URL: Custom API endpoint (defaults to official API)
# - DEEPSEEK_MODEL: Model name (defaults to "deepseek-chat")  
# - OPENAI_MODEL: Model name (defaults to "gpt-4o")
# ============================================================================

import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# ── AI PROVIDER CONFIGURATION ──────────────────────────────────────────────
# Settings for DeepSeek AI provider
DEEPSEEK_API_KEY  = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
DEEPSEEK_MODEL    = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

# Settings for OpenAI provider
OPENAI_API_KEY    = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL      = os.getenv("OPENAI_MODEL", "gpt-4o")

# ── CONTENT PROCESSING LIMITS ──────────────────────────────────────────────
# Maximum PDF characters to send in full-text mode
# This prevents hitting model context limits and controls costs
# 400k characters ≈ 120k tokens with safety margin for GPT-4 models
MAX_PDF_CHARS = 400_000

# Maximum number of claims to extract per paper
# Balances thoroughness with processing time and token usage
# Academic papers typically have 3-8 key findings worth capturing
MAX_CLAIMS = 8

# ── AI MODEL BEHAVIOR SETTINGS ─────────────────────────────────────────────
# Low temperature for consistent structured extraction
# 0.2 provides good balance between accuracy and slight variation (AI recommendation)
# Higher values would increase creativity but reduce consistency
AI_TEMPERATURE = 0.2