# ============================================================================
# AI PROVIDER - OPENAI IMPLEMENTATION  
# ============================================================================
# This module implements the AIProvider interface for OpenAI GPT models.
#
# KEY FEATURES:
# 1. Official OpenAI Python client library integration
# 2. JSON response format enforcement for structured output
# 3. Support for latest GPT models (GPT-4, GPT-4 Turbo, etc.)
# 4. Automatic retry and rate limiting handling by client
# 5. Comprehensive error handling for API failures
#
# ============================================================================

from openai import OpenAI
from .base import AIProvider
from ..config import (
    OPENAI_API_KEY,
    OPENAI_MODEL,
    AI_TEMPERATURE,
)


class OpenAIProvider(AIProvider):
    """
    Tried Once - OpenAI GPT service provider implementation.
    
    Handles communication with OpenAI's chat completion API using the official
    Python client library.
    
    The provider leverages OpenAI's JSON mode to ensure consistent structured
    output that can be reliably parsed by the enrichment pipeline.
    """

    def __init__(self, model: str | None = None):
        """
        Initialize OpenAI provider with configuration.
        
        Sets up the official OpenAI client with API credentials and model
        selection from environment variables.
        
        Args:
            model (str | None): Override default model name.
                              If None, uses OPENAI_MODEL from config.
                              Common options: "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"
                              
        Raises:
            ValueError: If OPENAI_API_KEY is not configured in environment
        """
        # Model configuration with environment variable fallback
        self.model = model or OPENAI_MODEL

        # Validate required API key configuration
        if not OPENAI_API_KEY:
            raise ValueError(
                "OPENAI_API_KEY is not set. "
                "Add it to your .env file."
            )

        # Initialize official OpenAI client
        # The client handles authentication, rate limiting, and retries automatically
        self._client = OpenAI(api_key=OPENAI_API_KEY)

    @property
    def name(self) -> str:
        """
        Provider identification for logging and monitoring.
        
        Returns:
            str: Human-readable provider/model identifier
        """
        return f"openai/{self.model}"

    def complete(self, system_prompt: str, user_prompt: str) -> str:
        """
        Execute chat completion request with OpenAI API.
        
        Sends structured prompts to OpenAI GPT models and returns the raw response.
        Uses JSON response mode to ensure consistent structured output for
        the parsing pipeline.
        
        Args:
            system_prompt (str): System instructions for AI behavior and role
            user_prompt (str): Content and specific extraction instructions
            
        Returns:
            str: Raw JSON response from OpenAI API
            
        Raises:
            openai.APIError: For API-specific errors (rate limits, invalid requests)
            openai.AuthenticationError: For API key authentication issues
            openai.RateLimitError: For quota or rate limit exceeded
            Exception: For other unexpected errors
            
        Note:
            The OpenAI client automatically handles:
            - Exponential backoff retry for transient failures
            - Rate limit detection and waiting
            - Connection error recovery
        """
        # ── CHAT COMPLETION REQUEST ──────────────────────────────────────────
        # Use official OpenAI client for robust API communication
        response = self._client.chat.completions.create(
            model=self.model,
            temperature=AI_TEMPERATURE,  # Low temperature for consistent extraction
            
            # Force JSON response format for reliable parsing
            # This ensures the model outputs valid JSON structure
            response_format={"type": "json_object"},
            
            # Conversation messages with role-based prompting
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
        )
        
        # Extract response content from the API response object
        return response.choices[0].message.content