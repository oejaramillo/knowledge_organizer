# ============================================================================
# ZOTERO SYNCHRONIZATION - PAPERS MODULE
# ============================================================================
# This module handles synchronization of academic papers (and other documents)
# from Zotero to the research database. It processes bibliographic metadata,
# manages project associations, and handles various document types.
#
# KEY OPERATIONS:
# 1. Extract bibliographic metadata from Zotero items
# 2. Map document types to internal classification system
# 3. Parse publication dates and extract year information  
# 4. Handle project associations through collection memberships
# 5. Perform upsert operations to handle both new and updated papers
#
# DOCUMENT TYPES SUPPORTED:
# - Journal articles, books, book chapters
# - Working papers, dissertations, reports  
# - Policy documents and other research materials
# ============================================================================

import re
from db import get_db_connection


def extract_year(date_str):
    """
    AI recommendation
    Extract publication year from various date string formats.
    
    Academic papers have inconsistent date formatting across sources.
    This function robustly extracts 4-digit years from common formats:
    - "2023-01-15" -> 2023
    - "January 2023" -> 2023  
    - "2023/01/15" -> 2023
    - "c. 2023" -> 2023
    
    Args:
        date_str: Date string from Zotero metadata
        
    Returns:
        int | None: Extracted 4-digit year or None if not found
        
    Note:
        Restricts year range to 1500-2099 to filter out invalid dates
        like page numbers or other numeric values.
    """
    if not date_str:
        return None

    # Use regex to find 4-digit years within reasonable academic range
    # Pattern matches years from 1500 to 2099 (covers historical to future papers)
    match = re.search(r"\b(1[5-9]\d{2}|20\d{2})\b", str(date_str))
    return int(match.group(0)) if match else None


def sync_papers(client, since=None, since_date=None):
    """
    Synchronize papers from Zotero to the database.
    
    This function handles the complete paper synchronization workflow:
    1. Fetch changed papers from Zotero API
    2. Extract and normalize bibliographic metadata
    3. Upsert papers with conflict resolution
    4. Rebuild project associations to reflect current collections
    
    Args:
        client: ZoteroClient instance for API communication
        since (int | None): Library version for incremental sync
        since_date (str | None): Timestamp fallback for filtering
        
    Note:
        Uses UPSERT pattern with conflict resolution on zotero_key
        to handle both new papers and updates to existing ones.
    """
    # ── DETERMINE SYNC SCOPE ─────────────────────────────────────────────────
    # Build descriptive label for progress reporting
    label = (
        f"(incremental since v{since})" if since is not None
        else f"(incremental since {since_date})" if since_date is not None
        else "(full sync)"
    )
    print(f"Syncing papers... {label}")

    # ── FETCH DATA FROM ZOTERO ───────────────────────────────────────────────
    # Get top-level items (excludes attachments, notes, annotations)
    items = client.get_top_level_items(since=since, since_date=since_date)

    # Early return if no changes detected
    if not items:
        print("No paper changes detected.")
        return

    # ── PROCESS PAPERS IN TRANSACTION ────────────────────────────────────────
    synced = 0

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            for item in items:
                data = item.get("data", {})
                item_type = data.get("itemType")

                # ── FILTER NON-PAPER ITEMS ───────────────────────────────────
                # Skip items that aren't actual papers/documents
                if item_type in ("attachment", "note", "annotation"):
                    continue

                # ── EXTRACT CORE METADATA ────────────────────────────────────
                zotero_key = data.get("key")
                if not zotero_key:
                    continue

                # Use title or provide default for items without titles
                title = data.get("title") or "Untitled"

                # ── UPSERT PAPER RECORD ──────────────────────────────────────
                # Insert new paper or update existing one based on zotero_key
                cur.execute(
                    """
                    INSERT INTO papers (
                        title,
                        doi,
                        zotero_key,
                        year,
                        journal,
                        volume,
                        issue,
                        pages,
                        abstract,
                        url,
                        document_type,
                        status
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'unread')
                    ON CONFLICT (zotero_key)
                    DO UPDATE SET
                        title = EXCLUDED.title,
                        doi = EXCLUDED.doi,
                        year = EXCLUDED.year,
                        journal = EXCLUDED.journal,
                        volume = EXCLUDED.volume,
                        issue = EXCLUDED.issue,
                        pages = EXCLUDED.pages,
                        abstract = EXCLUDED.abstract,
                        url = EXCLUDED.url,
                        document_type = EXCLUDED.document_type,
                        updated_at = NOW()
                    RETURNING paper_id
                    """,
                    (
                        title,
                        data.get("DOI"),                    # Digital Object Identifier
                        zotero_key,                         # Unique Zotero reference
                        extract_year(data.get("date")),     # Publication year
                        
                        # Publication venue - prioritize journal, then book, then institution
                        data.get("publicationTitle") or data.get("bookTitle") or data.get("university"),
                        
                        data.get("volume"),                 # Volume number
                        data.get("issue"),                  # Issue number  
                        data.get("pages"),                  # Page range
                        data.get("abstractNote"),           # Abstract text
                        data.get("url"),                    # Online URL
                        
                        # Document type mapping
                        "journal_article" if item_type == "journalArticle" else "other",
                    ),
                )

                paper_id = cur.fetchone()["paper_id"]

                # ── REBUILD PROJECT ASSOCIATIONS ─────────────────────────────
                # Clear existing associations and rebuild from current collections
                # This ensures removals in Zotero are reflected in the database
                cur.execute(
                    """
                    DELETE FROM paper_projects
                    WHERE paper_id = %s
                    """,
                    (paper_id,),
                )

                # Link paper to projects based on collection membership
                for col_key in data.get("collections", []):
                    cur.execute(
                        """
                        INSERT INTO paper_projects (paper_id, project_id)
                        SELECT %s, project_id
                        FROM projects
                        WHERE zotero_collection_key = %s
                        ON CONFLICT DO NOTHING
                        """,
                        (paper_id, col_key),
                    )

                synced += 1

            # Commit all changes as a single transaction
            conn.commit()

    print(f"Successfully synced {synced} papers.")