# ============================================================================
# AI PROVIDER - ABSTRACT BASE CLASS
# ============================================================================
# This module defines the abstract interface that all AI providers must
# implement. It establishes a common contract for AI services, enabling
# easy switching between different providers (OpenAI, DeepSeek, etc.)
# without changing the core enrichment pipeline code.
#
# DESIGN PATTERN: Strategy Pattern
# - AIProvider: Abstract strategy interface
# - DeepSeekProvider, OpenAIProvider: Concrete strategy implementations  
# - EnrichmentPipeline: Context that uses strategies
#
# This design enables:
# 1. Easy provider switching via command-line arguments
# 2. Cost optimization by comparing providers
# 3. Fallback mechanisms if one provider fails
# 4. Testing with mock providers
# ============================================================================

from abc import ABC, abstractmethod


class AIProvider(ABC):
    """
    AI rrecommendation
    Abstract base class defining the interface for AI service providers.
    
    This class establishes the contract that all AI providers must follow,
    ensuring consistent behavior across different AI services. The interface
    is intentionally minimal to accommodate various provider architectures
    while maintaining compatibility with the enrichment pipeline.
    
    The abstract methods must be implemented by concrete provider classes
    to handle the specific API communication patterns of each service.
    """

    @abstractmethod
    def complete(self, system_prompt: str, user_prompt: str) -> str:
        """
        Execute a chat completion request with the AI provider.
        
        This is the core method that sends structured prompts to the AI
        service and returns the raw response content. All providers must
        implement this method to handle their specific API protocols.
        
        Args:
            system_prompt (str): System-level instructions that set the AI's
                               role, behavior, and output format constraints
            user_prompt (str): User message containing the paper content and
                             specific extraction instructions
        
        Returns:
            str: Raw text content from the AI model's response
                Must be valid JSON when parsed by the parser module
                
        Raises:
            Exception: Provider-specific exceptions for API failures,
                      network issues, authentication problems, etc.
                      
        Note:
            Implementations should handle provider-specific error conditions
            and rate limiting, but let critical errors bubble up for handling
            by the enrichment pipeline.
        """
        ...

    @property
    @abstractmethod
    def name(self) -> str:
        """
        Human-readable identifier for the provider and model combination.
        
        This property provides a descriptive name used for:
        - Progress reporting during enrichment
        - Logging and debugging output  
        - Cost tracking and usage analytics
        - Provider performance comparison
        
        Returns:
            str: Provider/model identifier (e.g., "openai/gpt-4o", "deepseek/deepseek-chat")
            
        Note:
            Should include both provider name and model name for
            clear identification in multi-provider environments.
        """
        ...