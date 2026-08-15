# ============================================================================
# AI PROVIDER - DEEPSEEK IMPLEMENTATION
# ============================================================================
# This module implements the AIProvider interface for DeepSeek AI services.
# DeepSeek offers competitive pricing and strong performance for structured
# extraction tasks, making it an excellent choice for research content processing.
#
# KEY FEATURES:
# 1. Direct HTTP API integration with requests library
# 2. JSON response format enforcement for structured output
# 3. Configurable model and endpoint selection
# 4. Comprehensive error handling for API failures
# 5. Timeout protection for long-running requests
#
# DEEPSEEK ADVANTAGES:
# - Cost-effective pricing for large-scale processing
# - Strong performance on structured extraction tasks
# - Reliable JSON output formatting
# ============================================================================

import requests
from .base import AIProvider
from ..config import (
    DEEPSEEK_API_KEY,
    DEEPSEEK_BASE_URL,
    DEEPSEEK_MODEL,
    AI_TEMPERATURE,
)


class DeepSeekProvider(AIProvider):
    """
    DeepSeek AI service provider implementation.
    
    Handles communication with DeepSeek's chat completion API for structured
    knowledge extraction from academic papers. Provides cost-effective AI
    processing with reliable JSON output formatting.
    
    The provider uses DeepSeek's native JSON response format to ensure
    consistent structured output for the parsing pipeline.
    """

    def __init__(self, model: str | None = None):
        """
        Initialize DeepSeek provider with configuration.
        
        Sets up API credentials, model selection, and endpoint configuration
        from environment variables with sensible defaults.
        
        Args:
            model (str | None): Override default model name.
                              If None, uses DEEPSEEK_MODEL from config.
                              
        Raises:
            ValueError: If DEEPSEEK_API_KEY is not configured in environment
        """
        # Model configuration with environment variable fallback
        self.model = model or DEEPSEEK_MODEL
        
        # API credentials and endpoint configuration
        self.api_key = DEEPSEEK_API_KEY
        self.base_url = DEEPSEEK_BASE_URL

        # Validate required API key configuration
        if not self.api_key:
            raise ValueError(
                "DEEPSEEK_API_KEY is not set. "
                "Add it to your .env file."
            )

    @property
    def name(self) -> str:
        """
        Provider identification for logging and monitoring.
        
        Returns:
            str: Human-readable provider/model identifier
        """
        return f"deepseek/{self.model}"

    def complete(self, system_prompt: str, user_prompt: str) -> str:
        """
        Execute chat completion request with DeepSeek API.
        
        Sends structured prompts to DeepSeek and returns the raw response.
        Uses JSON response format to ensure consistent structured output
        for the parsing pipeline.
        
        Args:
            system_prompt (str): System instructions for AI behavior
            user_prompt (str): Content and extraction instructions
            
        Returns:
            str: Raw JSON response from DeepSeek API
            
        Raises:
            requests.RequestException: For HTTP errors, timeouts, or connection issues
            ValueError: For API key authentication failures
            Exception: For other API-specific errors
            
        Note:
            Uses 120-second timeout to handle complex academic content
            processing while preventing indefinite hangs.
        """
        # ── HTTP REQUEST CONFIGURATION ───────────────────────────────────────
        # Prepare headers with API authentication
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        # ── REQUEST PAYLOAD CONSTRUCTION ─────────────────────────────────────
        # Build chat completion request with structured output format
        payload = {
            "model": self.model,
            "temperature": AI_TEMPERATURE,  # Low temperature for consistent extraction
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            # Force JSON response format for reliable parsing
            "response_format": {"type": "json_object"},
        }

        # ── API REQUEST EXECUTION ────────────────────────────────────────────
        # Send request with timeout protection and error handling
        response = requests.post(
            f"{self.base_url}/chat/completions",
            headers=headers,
            json=payload,
            timeout=120,  # 2-minute timeout for complex content processing
        )
        
        # Raise exception for HTTP error status codes
        response.raise_for_status()

        # Extract and return response content
        return response.json()["choices"][0]["message"]["content"]