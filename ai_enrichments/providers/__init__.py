"""AI provider implementations.

The concrete providers are imported lazily so that using one provider (for
example ``deepseek``) never requires the other provider's SDK to be installed.
Import a concrete class directly::

    from ai_enrichments.providers.deepseek import DeepSeekProvider
"""

from .base import AIProvider

__all__ = ["AIProvider", "DeepSeekProvider", "OpenAIProvider"]


def __getattr__(name: str):
    """Resolve provider classes on first access (PEP 562 module-level __getattr__)."""
    if name == "DeepSeekProvider":
        from .deepseek import DeepSeekProvider
        return DeepSeekProvider
    if name == "OpenAIProvider":
        from .openai import OpenAIProvider
        return OpenAIProvider
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")