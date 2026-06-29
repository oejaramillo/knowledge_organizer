import os
from datetime import datetime, timezone
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

        raw = response.headers.get("Zotero-Library-Version")
        if raw is not None:
            try:
                self.last_library_version = int(raw)
            except ValueError:
                pass

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
            try:
                self.last_library_version = int(raw)
            except ValueError:
                pass

        return {
            "api_version": response.headers.get("Zotero-API-Version"),
            "schema_version": response.headers.get("Zotero-Schema-Version"),
            "library_version": self.last_library_version,
        }

    def _parse_datetime(self, value: str | None) -> datetime | None:
        if not value:
            return None

        value = str(value).strip()

        formats = [
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
        ]

        for fmt in formats:
            try:
                dt = datetime.strptime(value, fmt)
                return dt.replace(tzinfo=timezone.utc)
            except ValueError:
                continue

        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except ValueError:
            return None

    def _filter_by_since_date(self, items: list, since_date: str | None) -> list:
        if since_date is None:
            return items

        threshold = self._parse_datetime(since_date)
        if threshold is None:
            return items

        filtered = []

        for item in items:
            data = item.get("data", {})
            modified = self._parse_datetime(data.get("dateModified"))

            # If dateModified is missing, keep the item to avoid missing updates
            if modified is None or modified > threshold:
                filtered.append(item)

        return filtered

    def get_top_level_items(
        self,
        since: int | None = None,
        since_date: str | None = None,
    ) -> list:
        params = {"include": "data"}
        if since is not None:
            params["since"] = since

        items = self._get("users/0/items/top", params=params)
        if since is None:
            items = self._filter_by_since_date(items, since_date)
        return items

    def get_collections(
        self,
        since: int | None = None,
        since_date: str | None = None,
    ) -> list:
        params = {"include": "data"}
        if since is not None:
            params["since"] = since

        collections = self._get("users/0/collections", params=params)
        if since is None:
            collections = self._filter_by_since_date(collections, since_date)
        return collections

    def get_attachments(
        self,
        since: int | None = None,
        since_date: str | None = None,
    ) -> list:
        params = {"itemType": "attachment"}
        if since is not None:
            params["since"] = since

        attachments = self._get("users/0/items", params=params)
        if since is None:
            attachments = self._filter_by_since_date(attachments, since_date)
        return attachments

    def get_annotations(
        self,
        since: int | None = None,
        since_date: str | None = None,
    ) -> list:
        params = {"itemType": "annotation"}
        if since is not None:
            params["since"] = since

        annotations = self._get("users/0/items", params=params)
        if since is None:
            annotations = self._filter_by_since_date(annotations, since_date)
        return annotations