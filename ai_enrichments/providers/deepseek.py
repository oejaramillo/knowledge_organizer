import requests
from .base import AIProvider
from ..config import (
    DEEPSEEK_API_KEY,
    DEEPSEEK_BASE_URL,
    DEEPSEEK_MODEL,
    AI_TEMPERATURE,
)


class DeepSeekProvider(AIProvider):
    def __init__(self, model: str | None = None):
        self.model = model or DEEPSEEK_MODEL
        self.api_key = DEEPSEEK_API_KEY
        self.base_url = DEEPSEEK_BASE_URL

        if not self.api_key:
            raise ValueError(
                "DEEPSEEK_API_KEY is not set. "
                "Add it to your .env file."
            )

    @property
    def name(self) -> str:
        return f"deepseek/{self.model}"

    def complete(self, system_prompt: str, user_prompt: str) -> str:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": self.model,
            "temperature": AI_TEMPERATURE,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            # Ask DeepSeek to return JSON directly
            "response_format": {"type": "json_object"},
        }

        response = requests.post(
            f"{self.base_url}/chat/completions",
            headers=headers,
            json=payload,
            timeout=120,
        )
        response.raise_for_status()

        return response.json()["choices"][0]["message"]["content"]