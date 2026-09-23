import re

from db import get_db_connection
from utils import announce


def extract_year(date_str):
    if not date_str:
        return None

    match = re.search(r"\b(1[5-9]\d{2}|20\d{2})\b", str(date_str))
    return int(match.group(0)) if match else None


def sync_papers(client, since=None, since_date=None):
    announce("papers", since=since, since_date=since_date)

    items = client.get_top_level_items(since=since, since_date=since_date)

    if not items:
        print("No paper changes detected.")
        return 0

    synced = 0

    # Column order for the two statements. A paper is written with an INSERT
    # only the first time it is seen; afterwards a bulk UPDATE keeps the number
    # of database round-trips independent of the library size.
    INSERT_COLUMNS = ("title", "doi", "zotero_key", "year", "journal",
                      "volume", "issue", "pages", "abstract", "url", "document_type")
    UPDATE_COLUMNS = ("title", "doi", "year", "journal", "volume",
                      "issue", "pages", "abstract", "url", "document_type", "zotero_key")

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT zotero_key, paper_id FROM papers WHERE zotero_key IS NOT NULL")
            paper_ids = {r["zotero_key"]: r["paper_id"] for r in cur.fetchall()}

            cur.execute(
                """
                SELECT zotero_collection_key, project_id
                FROM projects
                WHERE zotero_collection_key IS NOT NULL
                """
            )
            project_ids = {r["zotero_collection_key"]: r["project_id"] for r in cur.fetchall()}

            new_records = []
            updates = []
            links = {}
            processed_ids = []

            for item in items:
                data = item.get("data", {})
                item_type = data.get("itemType")

                if item_type in ("attachment", "note", "annotation"):
                    continue

                zotero_key = data.get("key")
                if not zotero_key:
                    continue

                # NOTE: `document_type` stores Zotero's own item type verbatim
                # (camelCase: "journalArticle", "bookSection", ...). The API, the
                # dashboard and the enrichment tool all rely on that vocabulary,
                # so do not translate it to snake_case here.
                #
                # `status` is deliberately NOT written: it belongs to the AI
                # enrichment pipeline. Reading progress lives in `is_read`.
                record = {
                    "title": data.get("title") or "Untitled",
                    "doi": data.get("DOI"),
                    "zotero_key": zotero_key,
                    "year": extract_year(data.get("date")),
                    "journal": (data.get("publicationTitle") or data.get("bookTitle")
                                or data.get("university")),
                    "volume": data.get("volume"),
                    "issue": data.get("issue"),
                    "pages": data.get("pages"),
                    "abstract": data.get("abstractNote"),
                    "url": data.get("url"),
                    "document_type": item_type or "document",
                }

                paper_id = paper_ids.get(zotero_key)
                collection_keys = [
                    key for key in data.get("collections", []) if key in project_ids
                ]

                if paper_id is None:
                    new_records.append((record, collection_keys))
                else:
                    updates.append(tuple(record[c] for c in UPDATE_COLUMNS))
                    processed_ids.append(paper_id)
                    # Rebuild the links so project removals in Zotero are reflected
                    links[paper_id] = [project_ids[key] for key in collection_keys]

                synced += 1

            # Genuinely new papers (first sync, or items added since) need their
            # generated id back, so those are written one by one.
            for record, collection_keys in new_records:
                cur.execute(
                    """
                    INSERT INTO papers (
                        title, doi, zotero_key, year, journal, volume,
                        issue, pages, abstract, url, document_type
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                    tuple(record[c] for c in INSERT_COLUMNS),
                )
                paper_id = cur.fetchone()["paper_id"]
                paper_ids[record["zotero_key"]] = paper_id
                processed_ids.append(paper_id)
                links[paper_id] = [project_ids[key] for key in collection_keys]

            if updates:
                cur.executemany(
                    """
                    UPDATE papers SET
                        title = %s,
                        doi = %s,
                        year = %s,
                        journal = %s,
                        volume = %s,
                        issue = %s,
                        pages = %s,
                        abstract = %s,
                        url = %s,
                        document_type = %s,
                        updated_at = NOW()
                    WHERE zotero_key = %s
                    """,
                    updates,
                )

            if processed_ids:
                cur.execute(
                    "DELETE FROM paper_projects WHERE paper_id = ANY(%s)",
                    (processed_ids,),
                )

            link_rows = [(pid, proj) for pid, projs in links.items() for proj in projs]
            if link_rows:
                cur.executemany(
                    """
                    INSERT INTO paper_projects (paper_id, project_id)
                    VALUES (%s, %s)
                    ON CONFLICT DO NOTHING
                    """,
                    link_rows,
                )

            conn.commit()

    print(f"Successfully synced {synced} papers.")
    return synced