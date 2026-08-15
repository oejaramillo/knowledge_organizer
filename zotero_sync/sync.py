# ============================================================================
# ZOTERO SYNCHRONIZATION - MAIN ORCHESTRATOR
# ============================================================================
# This module coordinates the complete Zotero synchronization workflow,
# pulling data from Zotero's Local API and persisting it to the PostgreSQL
# database. It handles both full and incremental synchronization strategies.
#
# SYNCHRONIZATION STRATEGY:
# 1. Full Sync: Complete data refresh (first run or forced)
# 2. Incremental Sync: Only fetch changes since last sync
#    - Version-based: Uses Zotero library version numbers (preferred)
#    - Timestamp-based: Fallback using dateModified fields
#
# SYNCHRONIZATION ORDER:
# 1. Projects (Collections) - Establishes organizational structure
# 2. Papers (Items) - Core bibliographic content
# 3. Authors - Author information and paper linkages
# 4. Attachments - PDF files and metadata
# 5. Annotations - Highlights and notes from PDFs
#
# Usage:
#   python -m zotero_sync.sync          # Incremental sync
#   python -m zotero_sync.sync --force  # Full re-sync
# ============================================================================

from datetime import datetime, timezone
import argparse

# Import Zotero API client and database utilities
from zotero_client import ZoteroClient
from db import get_db_connection, get_sync_state, save_sync_state

# Import specialized sync modules for each entity type
from sync_projects import sync_projects
from sync_papers import sync_papers
from sync_authors import sync_authors
from sync_attachments import sync_attachments
from sync_annotations import sync_annotations


def reset_sync_state():
    """
    Reset synchronization state to force a complete re-sync.
    
    This function clears the stored sync state, causing the next sync
    operation to treat the database as if it's never been synchronized.
    This triggers a full sync of all data from Zotero.
    
    Use cases:
    - Recovering from sync corruption
    - Testing full sync workflows
    - Major schema changes requiring complete refresh
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Clear version and timestamp tracking
            cur.execute("UPDATE sync_state SET last_library_version = NULL, last_sync = NULL")
        conn.commit()
    print("Sync state reset — will run full sync.")


def main():
    """
    Main synchronization orchestrator.
    
    This function coordinates the complete Zotero sync workflow:
    1. Parse command line arguments
    2. Initialize Zotero client and check library status
    3. Determine sync strategy (full vs incremental)
    4. Execute sync modules in proper dependency order
    5. Update sync state tracking
    """
    
    # ── COMMAND LINE ARGUMENT PARSING ────────────────────────────────────────
    parser = argparse.ArgumentParser()
    parser.add_argument('--force', action='store_true', help='Force full re-sync of all data')
    args = parser.parse_args()

    # ── ZOTERO CLIENT INITIALIZATION ─────────────────────────────────────────
    # Initialize connection to Zotero Local API
    client = ZoteroClient()

    # Get current library state from Zotero
    info = client.get_library_info()
    current_version = info["library_version"]

    print(f"Connected to Zotero (API v{info['api_version']})")
    print(f"Current library version: {current_version or 'N/A (local API)'}")

    # ── SYNC STRATEGY DETERMINATION ──────────────────────────────────────────
    # Force full sync if requested
    if args.force:
        reset_sync_state()

    # Retrieve last sync state from database
    state = get_sync_state()
    last_version = state["last_library_version"]
    last_sync = state["last_sync"]

    # Determine appropriate sync strategy based on available information
    if last_sync is None:
        # First-time sync: full synchronization required
        print("No previous sync found. Running full sync...")
        since_version = None
        since_date = None
        
    elif current_version is not None and last_version == current_version:
        # Library unchanged: no sync needed
        print("Library is up to date. Nothing to sync.")
        return
        
    elif current_version is not None and last_version is not None:
        # Version-based incremental sync (preferred method)
        print(f"Incremental sync: changes since library version {last_version}")
        since_version = last_version
        since_date = None
        
    else:
        # Timestamp-based fallback when version tracking unavailable
        since_date = last_sync.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        print(f"Incremental sync: changes since {since_date} (timestamp fallback)")
        since_version = None

    # Record sync start time for state tracking
    sync_started_at = datetime.now(timezone.utc)

    # ── SYNCHRONIZATION EXECUTION ────────────────────────────────────────────
    # Execute sync modules in dependency order to maintain referential integrity
    
    # 1. Projects (Collections): Must come first as papers reference projects
    sync_projects(client, since=since_version, since_date=since_date)
    
    # 2. Papers (Items): Core content, must exist before authors/attachments
    sync_papers(client, since=since_version, since_date=since_date)
    
    # 3. Authors: Link author information to existing papers
    sync_authors(client, since=since_version, since_date=since_date)
    
    # 4. Attachments: PDF files and metadata, depends on papers
    sync_attachments(client, since=since_version, since_date=since_date)
    
    # 5. Annotations: Highlights and notes, depends on attachments
    sync_annotations(client, since=since_version, since_date=since_date)

    # ── SYNC STATE PERSISTENCE ───────────────────────────────────────────────
    # Save successful sync state for next incremental sync
    save_sync_state(current_version, sync_started_at)

    # ── COMPLETION REPORTING ─────────────────────────────────────────────────
    print("\n==============================")
    effective = f"v{current_version}" if current_version is not None else "timestamp-based"
    print(f"SYNC COMPLETE ({effective})")
    print("==============================")


if __name__ == "__main__":
    main()