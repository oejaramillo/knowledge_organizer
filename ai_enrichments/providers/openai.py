from openai import OpenAI
from .base import AIProvider
from ..config import (
    OPENAI_API_KEY,
    OPENAI_MODEL,
    AI_TEMPERATURE,
)


class OpenAIProvider(AIProvider):
    def __init__(self, model: str | None = None):
        self.model = model or OPENAI_MODEL

        if not OPENAI_API_KEY:
            raise ValueError(
                "OPENAI_API_KEY is not set. "
                "Add it to your .env file."
            )

        self._client = OpenAI(api_key=OPENAI_API_KEY)

    @property
    def name(self) -> str:
        return f"openai/{self.model}"

    def complete(self, system_prompt: str, user_prompt: str) -> str:
        response = self._client.chat.completions.create(
            model=self.model,
            temperature=AI_TEMPERATURE,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
        )
        return response.choices[0].message.content