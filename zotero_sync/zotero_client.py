import os
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv()


class ZoteroClient:
    def __init__(self):
        self.base_url = os.getenv("ZOTERO_URL", "http://localhost:23119/api")
        self.session = requests.Session()
        self.last_library_version: int | None = None

    def _get(self, endpoint: str, params: dict | None = None) -> Any:
        response = self.session.get(
            f"{self.base_url}/{endpoint}",
            params=params,
            timeout=30,
        )
        response.raise_for_status()

        # Capture the library version from every response header
        raw = response.headers.get("Zotero-Library-Version")
        if raw is not None:
            self.last_library_version = int(raw)

        return response.json()

    def get_library_info(self) -> dict:
        response = self.session.get(
            f"{self.base_url}/users/0/items",
            params={"limit": 1},
            timeout=30,
        )
        response.raise_for_status()

        raw = response.headers.get("Zotero-Library-Version")
        if raw is not None:
            self.last_library_version = int(raw)

        return {
            "api_version": response.headers.get("Zotero-API-Version"),
            "schema_version": response.headers.get("Zotero-Schema-Version"),
            "library_version": self.last_library_version,
        }

    def get_top_level_items(self, since: int | None = None) -> list:
        params: dict = {"include": "data"}
        if since is not None:
            params["since"] = since
        return self._get("users/0/items/top", params=params)

    def get_collections(self, since: int | None = None) -> list:
        params: dict = {"include": "data"}
        if since is not None:
            params["since"] = since
        return self._get("users/0/collections", params=params)

    def get_attachments(self, since: int | None = None) -> list:
        params: dict = {"itemType": "attachment"}
        if since is not None:
            params["since"] = since
        return self._get("users/0/items", params=params)

    def get_annotations(self, since: int | None = None) -> list:
        params: dict = {"itemType": "annotation"}
        if since is not None:
            params["since"] = since
        return self._get("users/0/items", params=params)