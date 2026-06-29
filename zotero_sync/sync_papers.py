import re

from db import get_db_connection


def extract_year(date_str):
    if not date_str:
        return None

    match = re.search(r"\b(1[5-9]\d{2}|20\d{2})\b", str(date_str))
    return int(match.group(0)) if match else None


def sync_papers(client, since=None, since_date=None):
    label = (
        f"(incremental since v{since})" if since is not None
        else f"(incremental since {since_date})" if since_date is not None
        else "(full sync)"
    )
    print(f"Syncing papers... {label}")

    items = client.get_top_level_items(since=since, since_date=since_date)

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
                if not zotero_key:
                    continue

                title = data.get("title") or "Untitled"

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
                        data.get("DOI"),
                        zotero_key,
                        extract_year(data.get("date")),
                        data.get("publicationTitle") or data.get("bookTitle") or data.get("university"),
                        data.get("volume"),
                        data.get("issue"),
                        data.get("pages"),
                        data.get("abstractNote"),
                        data.get("url"),
                        "journal_article" if item_type == "journalArticle" else "other",
                    ),
                )

                paper_id = cur.fetchone()["paper_id"]

                # Rebuild project links for this paper so removals in Zotero are reflected
                cur.execute(
                    """
                    DELETE FROM paper_projects
                    WHERE paper_id = %s
                    """,
                    (paper_id,),
                )

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

            conn.commit()

    print(f"Successfully synced {synced} papers.")