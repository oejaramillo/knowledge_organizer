# ============================================================================
# ZOTERO SYNCHRONIZATION - PROJECTS MODULE
# ============================================================================
# This module synchronizes Zotero collections with the projects table,
# creating a hierarchical project structure that mirrors the organization
# in Zotero. Collections in Zotero become projects in the research system.
#
# KEY OPERATIONS:
# 1. Fetch collection hierarchy from Zotero
# 2. Create/update projects with metadata
# 3. Establish parent-child relationships between projects
# 4. Handle nested collection structures
#
# SYNCHRONIZATION STRATEGY:
# - Two-pass approach: first create all projects, then establish hierarchy
# - This handles circular dependencies and ensures all referenced parents exist
# - Upsert pattern allows safe re-running without data corruption
# ============================================================================

from db import get_db_connection


def sync_projects(client, since=None, since_date=None):
    """
    Synchronize Zotero collections to projects table with hierarchy.
    
    This function maps Zotero's collection structure to the research
    management system's project hierarchy. Collections provide organizational
    structure for grouping related papers and research activities.
    
    The synchronization uses a two-pass strategy:
    1. First pass: Create/update all project records
    2. Second pass: Establish parent-child relationships
    
    This approach ensures referential integrity even when collections
    are processed in arbitrary order from the API.
    
    Args:
        client: ZoteroClient instance for API communication
        since (int | None): Library version for incremental sync
        since_date (str | None): Timestamp fallback for filtering
        
    Note:
        Projects inherit Zotero collection keys for bidirectional sync
        and maintain organizational hierarchy through parent_project FK.
    """
    # ── DETERMINE SYNC SCOPE ─────────────────────────────────────────────────
    # Build descriptive label for progress reporting
    label = (
        f"(incremental since v{since})" if since is not None
        else f"(incremental since {since_date})" if since_date is not None
        else "(full sync)"
    )
    print(f"Syncing collections to projects... {label}")

    # ── FETCH COLLECTIONS FROM ZOTERO ───────────────────────────────────────
    collections = client.get_collections(since=since, since_date=since_date)

    # Early return if no changes detected
    if not collections:
        print("No collection changes detected.")
        return

    # ── TWO-PASS SYNCHRONIZATION ─────────────────────────────────────────────
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            
            # ── PASS 1: CREATE/UPDATE ALL PROJECTS ──────────────────────────
            # Process all collections to ensure project records exist
            # before establishing parent-child relationships
            for col in collections:
                data = col.get("data", {})

                # ── UPSERT PROJECT RECORD ────────────────────────────────────
                # Create new project or update existing one
                cur.execute(
                    """
                    INSERT INTO projects (
                        zotero_collection_key,
                        name
                    )
                    VALUES (%s, %s)
                    ON CONFLICT (zotero_collection_key)
                    DO UPDATE SET
                        name = EXCLUDED.name,
                        updated_at = NOW()
                    """,
                    (
                        data.get("key"),     # Unique Zotero collection identifier
                        data.get("name")     # Collection/project name
                    ),
                )

            # ── PASS 2: ESTABLISH PARENT-CHILD HIERARCHY ─────────────────────
            # Now that all projects exist, we can safely set up relationships
            for col in collections:
                data = col.get("data", {})
                parent_key = data.get("parentCollection")
                
                # Skip collections without parent (top-level projects)
                if not parent_key:
                    continue

                # ── UPDATE PARENT RELATIONSHIP ───────────────────────────────
                # Link child project to parent using collection keys
                cur.execute(
                    """
                    UPDATE projects
                    SET parent_project = (
                        SELECT project_id
                        FROM projects
                        WHERE zotero_collection_key = %s
                    ),
                    updated_at = NOW()
                    WHERE zotero_collection_key = %s
                    """,
                    (parent_key, data.get("key")),
                )

            # Commit all changes as a single transaction
            conn.commit()

    print(f"Successfully synced {len(collections)} projects.")