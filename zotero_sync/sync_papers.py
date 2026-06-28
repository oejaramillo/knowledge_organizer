import re

from db import get_db_connection


def extract_year(date_str):
    if not date_str:
        return None
    match = re.search(r"\b(1[5-9]\d{2}|20\d{2})\b", str(date_str))
    return int(match.group(1)) if match else None


def sync_papers(client, since=None):
    label = f"(incremental since v{since})" if since is not None else "(full sync)"
    print(f"Syncing papers... {label}")

    items = client.get_top_level_items(since=since)

    if not items:
        print("No paper changes detected.")
        return

    synced = 0

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            for item in items:
                data = item.get("data", {})
                item_type = data.get("itemType")

                if item_type in ("attachment", "note", "annotation"):
                    continue

                zotero_key = data.get("key")
                title = data.get("title") or "Untitled"
                year = extract_year(data.get("date"))
                doi = data.get("DOI")
                journal = data.get("publicationTitle") or data.get("bookTitle")
                volume = data.get("volume")
                issue = data.get("issue")
                pages = data.get("pages")
                abstract = data.get("abstractNote")
                url = data.get("url")

                cur.execute(
                    """
                    INSERT INTO papers (
                        title, doi, zotero_key, year, journal,
                        volume, issue, pages, abstract, url
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (zotero_key)
                    DO UPDATE SET
                        title    = EXCLUDED.title,
                        doi      = EXCLUDED.doi,
                        year     = EXCLUDED.year,
                        journal  = EXCLUDED.journal,
                        volume   = EXCLUDED.volume,
                        issue    = EXCLUDED.issue,
                        pages    = EXCLUDED.pages,
                        abstract = EXCLUDED.abstract,
                        url      = EXCLUDED.url,
                        updated_at = NOW()
                    """,
                    (title, doi, zotero_key, year, journal,
                     volume, issue, pages, abstract, url)
                )

                # Link paper to collections
                collections = item.get("data", {}).get("collections", [])
                for col_key in collections:
                    cur.execute(
                        """
                        INSERT INTO paper_projects (paper_id, project_id)
                        SELECT p.paper_id, pr.project_id
                        FROM papers p, projects pr
                        WHERE p.zotero_key = %s
                          AND pr.zotero_collection_key = %s
                        ON CONFLICT DO NOTHING
                        """,
                        (zotero_key, col_key)
                    )

                synced += 1

            conn.commit()

    print(f"Successfully synced {synced} papers.")