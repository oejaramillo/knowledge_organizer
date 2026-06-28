import os
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv()


class ZoteroClient:
    def __init__(self):
        self.base_url = os.getenv("ZOTERO_URL", "http://localhost:23119/api")
        self.session = requests.Session()

    def _get(self, endpoint: str, params: dict | None = None) -> Any:
        response = self.session.get(
            f"{self.base_url}/{endpoint}",
            params=params,
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def get_library_info(self):
        response = self.session.get(
            f"{self.base_url}/users/0/items",
            params={"limit": 1},
            timeout=30,
        )
        response.raise_for_status()
        return {
            "api_version": response.headers.get("Zotero-API-Version"),
            "schema_version": response.headers.get("Zotero-Schema-Version"),
        }

    def get_top_level_items(self):
        return self._get(
            "users/0/items/top",
            params={"include": "data"},
        )

    def get_collections(self):
        return self._get(
            "users/0/collections",
            params={"include": "data"},
        )

    def get_children(self, item_key: str):
        return self._get(
            f"users/0/items/{item_key}/children"
        )

    def get_attachments(self):
        return self._get(
            "users/0/items",
            params={"itemType": "attachment"}
        )

    def get_annotations(self):
        return self._get(
            "users/0/items",
            params={"itemType": "annotation"}
        )