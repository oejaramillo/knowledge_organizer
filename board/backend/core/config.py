# ============================================================================
# APPLICATION CONFIGURATION MANAGEMENT
# ============================================================================
# This module handles application configuration loading and management.
# It loads environment variables from the project root and provides
# centralized configuration access throughout the application.
#
# CONFIGURATION HIERARCHY:
# 1. Environment variables from .env file in project root
# 2. System environment variables (override .env values)
# 3. Default fallback values where appropriate
#
# PATH RESOLUTION:
# The configuration system automatically locates the project root .env file
# regardless of where the application is started from, ensuring consistent
# environment loading across different execution contexts.
# ============================================================================

import os
from pathlib import Path
from dotenv import load_dotenv

# ── PROJECT ROOT DETECTION ─────────────────────────────────────────────────
# Navigate from current file location to project root directory
# Path resolution: config.py -> core -> backend -> board -> root

ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
ENV_PATH = ROOT_DIR / ".env"

# Load environment variables from the project root .env file
# This ensures consistent configuration regardless of execution location
load_dotenv(dotenv_path=ENV_PATH)

# ── CONFIGURATION CLASS ────────────────────────────────────────────────────
class Settings:
    """
    Application settings and configuration management.
    
    Centralizes all application configuration in a single class for:
    - Easy access throughout the application
    - Type hints and documentation
    - Environment variable management
    - Default value handling
    
    Attributes:
        PROJECT_TITLE (str): Human-readable application name for API docs
        DATABASE_URL (str): PostgreSQL connection string from environment
    """
    
    # Application metadata
    PROJECT_TITLE: str = "Research Board API"
    
    # Database configuration
    # Retrieved from environment variable set in project root .env file
    DATABASE_URL: str = os.getenv("DATABASE_URL")

# ── GLOBAL SETTINGS INSTANCE ───────────────────────────────────────────────
# Create singleton settings instance for application-wide access
# This provides consistent configuration access across all modules

settings = Settings()