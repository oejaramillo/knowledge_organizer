from db import get_db_connection
from utils import announce

# Zotero creator types that should be recorded as paper authors.
AUTHOR_TYPES = {"author", "presenter"}


def sync_authors(client, since=None, since_date=None):
    announce("authors and links", since=since, since_date=since_date)

    items = client.get_top_level_items(since=since, since_date=since_date)

    if not items:
        print("No author changes detected.")
        return 0

    papers_processed = 0

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # One lookup per run instead of one SELECT per paper.
            cur.execute("SELECT zotero_key, paper_id FROM papers WHERE zotero_key IS NOT NULL")
            papers_by_key = {r["zotero_key"]: r["paper_id"] for r in cur.fetchall()}

            cur.execute("SELECT author_id, full_name FROM authors")
            authors_by_name = {r["full_name"]: r["author_id"] for r in cur.fetchall()}

            # Keyed by paper so a repeated key in the payload cannot double-insert
            links: dict = {}
            paper_ids = []

            for item in items:
                data = item.get("data", {})
                item_type = data.get("itemType")

                if item_type in ("attachment", "note", "annotation"):
                    continue

                paper_key = data.get("key")
                if not paper_key:
                    continue

                paper_id = papers_by_key.get(paper_key)
                if not paper_id:
                    continue

                paper_ids.append(paper_id)

                position = 1
                for creator in data.get("creators", []):
                    if creator.get("creatorType") not in AUTHOR_TYPES:
                        continue

                    if creator.get("name"):
                        full_name = creator.get("name").strip()
                        first_name = None
                        last_name = full_name
                    else:
                        first_name = (creator.get("firstName") or "").strip() or None
                        last_name = (creator.get("lastName") or "").strip() or None
                        full_name = " ".join(
                            part for part in [first_name, last_name] if part
                        ).strip()

                    if not full_name:
                        continue

                    author_id = authors_by_name.get(full_name)
                    if author_id is None:
                        # Only genuinely new authors hit the database.
                        cur.execute(
                            """
                            INSERT INTO authors (full_name, first_name, last_name)
                            VALUES (%s, %s, %s)
                            ON CONFLICT (full_name)
                            DO UPDATE SET
                                first_name = EXCLUDED.first_name,
                                last_name = EXCLUDED.last_name
                            RETURNING author_id
                            """,
                            (full_name, first_name, last_name),
                        )
                        author_id = cur.fetchone()["author_id"]
                        authors_by_name[full_name] = author_id

                    links[(paper_id, author_id)] = (paper_id, author_id, position)
                    position += 1

                papers_processed += 1

            if paper_ids:
                # Rebuild author links only for the papers in this batch.
                cur.execute(
                    "DELETE FROM paper_authors WHERE paper_id = ANY(%s)",
                    (paper_ids,),
                )

            if links:
                cur.executemany(
                    """
                    INSERT INTO paper_authors (paper_id, author_id, position)
                    VALUES (%s, %s, %s)
                    ON CONFLICT DO NOTHING
                    """,
                    list(links.values()),
                )

            conn.commit()

    print(f"Successfully synced authors for {papers_processed} papers.")
    return papers_processed