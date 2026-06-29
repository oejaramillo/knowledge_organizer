from abc import ABC, abstractmethod


class AIProvider(ABC):
    """
    Abstract base for all AI providers.
    Every provider must implement a single method: complete().
    The rest of the pipeline never touches provider internals.
    """

    @abstractmethod
    def complete(self, system_prompt: str, user_prompt: str) -> str:
        """
        Send a chat completion request.
        Returns the raw text content of the model's reply.
        """
        ...

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable provider + model string for logging."""
        ...