# ============================================================================
# ZOTERO API CLIENT - HTTP COMMUNICATION LAYER
# ============================================================================
# This module provides a clean Python interface to Zotero's Local API,
# handling HTTP communication, response parsing, and data filtering.
# The Local API provides access to the user's Zotero library without
# requiring API keys or internet connectivity.
#
# KEY FEATURES:
# 1. Version-based change detection using library version headers
# 2. Timestamp-based filtering as fallback mechanism  
# 3. Automatic datetime parsing and timezone handling
# 4. Robust error handling for network and parsing issues
#
# API ENDPOINTS:
# - /users/0/items/top - Top-level library items (papers, books, etc.)
# - /users/0/collections - Collection hierarchy (projects/folders)
# - /users/0/items?itemType=attachment - File attachments
# - /users/0/items?itemType=annotation - PDF annotations
#
# LOCAL API DEFAULT: http://localhost:23119/api
# ============================================================================

import os
from datetime import datetime, timezone
from typing import Any

import requests
from dotenv import load_dotenv

# Load environment variables for API configuration
load_dotenv()


class ZoteroClient:
    """
    HTTP client for Zotero Local API communication.
    
    This client handles all HTTP communication with Zotero's Local API,
    providing a clean Python interface for data retrieval operations.
    It manages version tracking, request parameters, and response parsing.
    
    The Local API runs as a local server when Zotero is running, typically
    on http://localhost:23119/api. It provides read-only access to the
    user's library without requiring internet connectivity.
    """
    
    def __init__(self):
        """
        Initialize Zotero client with API configuration.
        
        Sets up base URL and HTTP session for efficient connection reuse.
        Initializes library version tracking for change detection.
        """
        # API endpoint configuration
        self.base_url = os.getenv("ZOTERO_URL", "http://localhost:23119/api")
        
        # HTTP session for connection pooling and efficiency  
        self.session = requests.Session()
        
        # Track library version for incremental sync detection
        self.last_library_version: int | None = None

    def _get(self, endpoint: str, params: dict | None = None) -> Any:
        """
        Execute HTTP GET request with automatic version tracking.
        
        This internal method handles all HTTP GET operations with:
        - Automatic timeout handling (30 seconds)
        - HTTP error detection and raising
        - Library version header extraction
        - JSON response parsing
        
        Args:
            endpoint (str): API endpoint path (relative to base_url)
            params (dict | None): Query parameters for the request
            
        Returns:
            Any: Parsed JSON response data
            
        Raises:
            requests.RequestException: For HTTP errors or timeouts
            ValueError: For invalid version header values
        """
        response = self.session.get(
            f"{self.base_url}/{endpoint}",
            params=params,
            timeout=30,
        )
        # Raise exception for HTTP error status codes (4xx, 5xx)
        response.raise_for_status()

        # Extract and parse library version from response headers
        # This version number is used for efficient incremental sync
        raw = response.headers.get("Zotero-Library-Version")
        if raw is not None:
            try:
                self.last_library_version = int(raw)
            except ValueError:
                # Handle malformed version headers gracefully
                pass

        return response.json()

    def get_library_info(self) -> dict:
        """
        Retrieve basic library information and API metadata.
        
        This method makes a minimal request to the API to:
        1. Test connectivity to Zotero Local API
        2. Retrieve API version information
        3. Get current library version for sync planning
        
        Returns:
            dict: Library information containing:
                  - api_version: Zotero API version string
                  - schema_version: Data schema version  
                  - library_version: Current library version number
                  
        Note:
            Uses limit=1 parameter to minimize data transfer while
            still retrieving essential header information.
        """
        response = self.session.get(
            f"{self.base_url}/users/0/items",
            params={"limit": 1},
            timeout=30,
        )
        response.raise_for_status()

        # Extract library version from response headers
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
        """
        Parse datetime strings from Zotero API responses.
        
        Handles multiple datetime formats used by Zotero:
        - ISO 8601 with Z suffix (UTC)
        - ISO 8601 without timezone info
        - Various space-separated formats
        - Malformed or missing datetime values
        
        All parsed datetimes are normalized to UTC timezone.
        
        Args:
            value (str | None): Datetime string from API response
            
        Returns:
            datetime | None: Parsed UTC datetime or None if parsing fails
        """
        if not value:
            return None

        value = str(value).strip()

        # Common datetime formats used by Zotero API
        formats = [
            "%Y-%m-%dT%H:%M:%SZ",      # ISO 8601 with Z (UTC)
            "%Y-%m-%d %H:%M:%S",       # Space-separated format
            "%Y-%m-%dT%H:%M:%S",       # ISO 8601 without timezone
        ]

        # Try standard formats first
        for fmt in formats:
            try:
                dt = datetime.strptime(value, fmt)
                return dt.replace(tzinfo=timezone.utc)
            except ValueError:
                continue

        # Fallback: use Python's ISO format parser
        try:
            # Handle Z suffix by converting to standard timezone format
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except ValueError:
            return None

    def _filter_by_since_date(self, items: list, since_date: str | None) -> list:
        """
        Filter items by modification date for timestamp-based sync.
        
        This method provides timestamp-based filtering as a fallback when
        version-based sync is not available. It compares each item's
        dateModified field against the provided threshold.
        
        Args:
            items (list): Items from API response
            since_date (str | None): Threshold datetime string
            
        Returns:
            list: Filtered items modified after the threshold
            
        Note:
            Items with missing dateModified are included to avoid
            missing updates during sync operations.
        """
        if since_date is None:
            return items

        # Parse threshold datetime
        threshold = self._parse_datetime(since_date)
        if threshold is None:
            return items

        filtered = []

        for item in items:
            data = item.get("data", {})
            modified = self._parse_datetime(data.get("dateModified"))

            # Include items with missing timestamps to be safe
            # Better to over-sync than miss updates
            if modified is None or modified > threshold:
                filtered.append(item)

        return filtered

    def get_top_level_items(
        self,
        since: int | None = None,
        since_date: str | None = None,
    ) -> list:
        """
        Retrieve top-level library items (papers, books, reports, etc.).
        
        Fetches all non-attachment, non-note items from the library.
        Supports both version-based and timestamp-based incremental sync.
        
        Args:
            since (int | None): Library version for incremental sync
            since_date (str | None): Fallback timestamp for filtering
            
        Returns:
            list: Top-level items with full metadata
            
        Note:
            Version-based sync (since parameter) is preferred when available
            as it's more efficient than timestamp-based filtering.
        """
        params = {"include": "data"}  # Include full item metadata
        
        if since is not None:
            # Version-based incremental sync (preferred)
            params["since"] = since

        items = self._get("users/0/items/top", params=params)
        
        # Apply timestamp filtering as fallback
        if since is None:
            items = self._filter_by_since_date(items, since_date)
            
        return items

    def get_collections(
        self,
        since: int | None = None,
        since_date: str | None = None,
    ) -> list:
        """
        Retrieve collection hierarchy (folders/projects in Zotero).
        
        Collections represent the organizational structure of the library,
        mapping to projects in the research management system.
        
        Args:
            since (int | None): Library version for incremental sync
            since_date (str | None): Fallback timestamp for filtering
            
        Returns:
            list: Collections with hierarchy and metadata
        """
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
        """
        Retrieve file attachments (PDFs, images, etc.).
        
        Attachments contain file metadata and links to actual files.
        PDF attachments are particularly important as they enable
        full-text processing and annotation sync.
        
        Args:
            since (int | None): Library version for incremental sync
            since_date (str | None): Fallback timestamp for filtering
            
        Returns:
            list: Attachment items with file metadata
        """
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
        """
        Retrieve PDF annotations (highlights, notes, comments).
        
        Annotations are the primary source for annotation-driven AI processing.
        They represent the researcher's focused attention on specific passages.
        
        Args:
            since (int | None): Library version for incremental sync
            since_date (str | None): Fallback timestamp for filtering
            
        Returns:
            list: Annotation items with highlight text and user notes
        """
        params = {"itemType": "annotation"}
        
        if since is not None:
            params["since"] = since

        annotations = self._get("users/0/items", params=params)
        
        if since is None:
            annotations = self._filter_by_since_date(annotations, since_date)
            
        return annotations