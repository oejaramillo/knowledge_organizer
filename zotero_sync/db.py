# ============================================================================
# DATABASE CONNECTION AND SYNC STATE MANAGEMENT
# ============================================================================
# This module provides database connectivity and sync state tracking utilities
# for the Zotero synchronization system. It handles PostgreSQL connections
# and maintains synchronization metadata for incremental sync operations.
#
# KEY FUNCTIONS:
# 1. Database connection management with automatic cleanup
# 2. Sync state persistence and retrieval  
# 3. Version and timestamp tracking for incremental sync
#
# SYNC STATE TRACKING:
# - last_library_version: Zotero library version number for efficient sync
# - last_sync: Timestamp of last successful sync for fallback filtering
# - source: Identifies sync source (default: "zotero")
# ============================================================================

import os
from contextlib import contextmanager
from datetime import datetime

import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv

# Load database configuration from environment
load_dotenv()

# PostgreSQL connection string from environment
# Format: postgresql://user:password@localhost:5432/research_db
DATABASE_URL = os.getenv("DATABASE_URL")


@contextmanager
def get_db_connection():
    """
    Context manager for database connections with automatic cleanup.
    
    Provides a managed PostgreSQL connection that:
    1. Uses dict_row factory for dictionary-style result access
    2. Automatically closes connection when context exits
    3. Handles connection errors gracefully
    4. Ensures proper resource cleanup
    
    Usage:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM papers")
                results = cur.fetchall()
    
    Yields:
        psycopg.Connection: Database connection with dict row factory
        
    Note:
        dict_row factory allows accessing columns by name rather than index,
        making code more readable and maintainable.
    """
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        yield conn


def get_sync_state(source: str = "zotero") -> dict:
    """
    Retrieve synchronization state for incremental sync operations.
    
    The sync state tracks the last successful synchronization to enable
    efficient incremental updates. It stores both version-based and
    timestamp-based tracking information.
    
    Args:
        source (str): Sync source identifier (default: "zotero")
        
    Returns:
        dict: Sync state information containing:
              - last_library_version: Last processed Zotero library version
              - last_sync: Timestamp of last successful sync
              
    Note:
        Returns None values for first-time sync or after state reset.
        This triggers full synchronization on next sync operation.
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT last_library_version, last_sync
                FROM sync_state
                WHERE source = %s
                """,
                (source,),
            )
            row = cur.fetchone()

            # Handle first-time sync case
            if row is None:
                return {
                    "last_library_version": None,
                    "last_sync": None,
                }

            return {
                "last_library_version": row["last_library_version"],
                "last_sync": row["last_sync"],
            }


def save_sync_state(
    version: int | None,
    sync_time: datetime,
    source: str = "zotero",
) -> None:
    """
    Persist synchronization state after successful sync completion.
    
    Updates the sync state tracking table with the latest sync information.
    Uses UPSERT pattern to handle both new sync source registration and
    updates to existing sync tracking records.
    
    Args:
        version (int | None): Current Zotero library version number
                             None for timestamp-based sync
        sync_time (datetime): Timestamp when sync operation started
        source (str): Sync source identifier (default: "zotero")
        
    Note:
        The sync_time should be recorded at sync start (not completion)
        to ensure consistent timestamp-based filtering on subsequent syncs.
        This prevents missing items that were modified during sync execution.
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # UPSERT operation: insert new or update existing sync state
            cur.execute(
                """
                INSERT INTO sync_state (source, last_library_version, last_sync)
                VALUES (%s, %s, %s)
                ON CONFLICT (source)
                DO UPDATE SET
                    last_library_version = EXCLUDED.last_library_version,
                    last_sync = EXCLUDED.last_sync
                """,
                (source, version, sync_time),
            )
            conn.commit()