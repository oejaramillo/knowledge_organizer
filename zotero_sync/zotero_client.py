"""Thin HTTP client for the Zotero API (local or web).

The client is deliberately dependency-free beyond ``requests`` and works with
both the Zotero *local* API (``http://localhost:23119/api``) and the Zotero
*web* API (``https://api.zotero.org``) by pointing ``ZOTERO_URL`` at either.

Two behaviours are important for correctness:

* **Library version tracking** — the version used for incremental ``since=``
  requests is read from the ``Last-Modified-Version`` response header (the
  header actually sent by Zotero). ``Zotero-Library-Version`` is still accepted
  as a fallback for older servers.
* **Pagination** — the Zotero web API paginates every read endpoint (default 25,
  max 100 items). The local API returns everything by default. We therefore
  follow the ``Link: <...>; rel="next"`` header when the server provides one,
  which is a no-op for the local API and avoids silent truncation on the web API.
"""

import os
import time
from datetime import datetime, timezone
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv()

DEFAULT_BASE_URL = "http://localhost:23119/api"
DEFAULT_TIMEOUT = 30

# Retry behaviour for transient Zotero failures (429 rate limit / 5xx).
MAX_ATTEMPTS = 4
BACKOFF_BASE_SECONDS = 1.0
RETRYABLE_STATUS = frozenset({429, 500, 502, 503, 504})


class ZoteroAPIError(RuntimeError):
    """Raised when the Zotero API cannot be reached or keeps failing."""


def parse_version_header(headers) -> int | None:
    """Extract the library version from response headers, if present."""
    for name in ("Last-Modified-Version", "Zotero-Library-Version"):
        raw = headers.get(name)
        if raw is None:
            continue
        try:
            return int(raw)
        except (TypeError, ValueError):
            continue
    return None


def parse_next_link(headers) -> str | None:
    """Return the URL of the ``rel="next"`` Link header entry, if any."""
    link_header = headers.get("Link")
    if not link_header:
        return None

    for part in link_header.split(","):
        segments = part.split(";")
        if len(segments) < 2:
            continue
        url = segments[0].strip()
        if not (url.startswith("<") and url.endswith(">")):
            continue
        relations = ";".join(segments[1:])
        if 'rel="next"' in relations or "rel=next" in relations:
            return url[1:-1]
    return None


class ZoteroClient:
    def __init__(self, base_url: str | None = None, timeout: int = DEFAULT_TIMEOUT):
        self.base_url = (base_url or os.getenv("ZOTERO_URL") or DEFAULT_BASE_URL).rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()
        self.last_library_version: int | None = None
        self._since_supported: bool | None = None

    # ── Capabilities ─────────────────────────────────────────────────────────

    def supports_since(self) -> bool:
        """Whether this Zotero API actually honours the ``since`` cursor.

        The Zotero *local* API (10.x) advertises a ``Last-Modified-Version``
        header but returns an empty list for **every** ``since=`` value, so an
        "incremental" sync silently syncs nothing while still exiting 0. Probe
        once per client and let the caller fall back to a full pass when the
        cursor is not usable.
        """
        if self._since_supported is None:
            try:
                probe = self._get("users/0/items/top", params={"since": 1, "limit": 1})
                self._since_supported = bool(probe)
            except Exception:      # network/HTTP problems: assume the worst
                self._since_supported = False
        return self._since_supported

    # ── HTTP plumbing ────────────────────────────────────────────────────────

    def _retry_delay(self, response, attempt: int) -> float:
        """Seconds to wait before retrying; honours ``Retry-After`` when given."""
        retry_after = response.headers.get("Retry-After")
        if retry_after:
            try:
                return max(0.0, float(retry_after))
            except (TypeError, ValueError):
                pass
        return BACKOFF_BASE_SECONDS * (2 ** attempt)

    def _request(self, url: str, params: dict | None = None):
        """GET ``url`` retrying transient failures. Returns the raw response."""
        last_error: Exception | None = None

        for attempt in range(MAX_ATTEMPTS):
            try:
                response = self.session.get(url, params=params, timeout=self.timeout)
            except requests.RequestException as exc:
                last_error = exc
            else:
                if response.status_code in RETRYABLE_STATUS and attempt < MAX_ATTEMPTS - 1:
                    time.sleep(self._retry_delay(response, attempt))
                    continue
                try:
                    response.raise_for_status()
                except requests.HTTPError as exc:
                    raise ZoteroAPIError(
                        f"Zotero API request failed ({response.status_code}) for {url}: "
                        f"{response.text[:200]}"
                    ) from exc
                return response

            if attempt < MAX_ATTEMPTS - 1:
                time.sleep(BACKOFF_BASE_SECONDS * (2 ** attempt))

        raise ZoteroAPIError(f"Zotero API unreachable after {MAX_ATTEMPTS} attempts: {url}") from last_error

    def _record_version(self, response) -> None:
        version = parse_version_header(response.headers)
        if version is not None:
            self.last_library_version = version

    def _get(self, endpoint: str, params: dict | None = None, paginate: bool = False) -> Any:
        """Fetch ``endpoint``, optionally walking every page of results."""
        url: str | None = f"{self.base_url}/{endpoint}"
        query: dict | None = params
        pages: list = []

        while url:
            response = self._request(url, query)
            self._record_version(response)
            payload = response.json()

            if not paginate:
                return payload

            if isinstance(payload, list):
                pages.extend(payload)
            else:
                # Non-list payloads cannot be paginated; return them as-is.
                return payload

            url = parse_next_link(response.headers)
            query = None

        return pages

    # ── Public API ───────────────────────────────────────────────────────────

    def get_library_info(self) -> dict:
        response = self._request(
            f"{self.base_url}/users/0/items",
            params={"limit": 1},
        )
        self._record_version(response)

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
        """Client-side fallback when the server sends no usable library version."""
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

        items = self._get("users/0/items/top", params=params, paginate=True)
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

        collections = self._get("users/0/collections", params=params, paginate=True)
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

        attachments = self._get("users/0/items", params=params, paginate=True)
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

        annotations = self._get("users/0/items", params=params, paginate=True)
        if since is None:
            annotations = self._filter_by_since_date(annotations, since_date)
        return annotations

    def get_children(self, item_key: str) -> list:
        """Return every child item (attachments, notes, annotations) of ``item_key``."""
        return self._get(f"users/0/items/{item_key}/children", paginate=True)
