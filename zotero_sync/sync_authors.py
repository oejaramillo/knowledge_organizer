from db import get_db_connection


def sync_authors(client, since=None, since_date=None):
    label = (
        f"(incremental since v{since})" if since is not None
        else f"(incremental since {since_date})" if since_date is not None
        else "(full sync)"
    )
    print(f"Syncing authors and links... {label}")

    items = client.get_top_level_items(since=since, since_date=since_date)

    if not items:
        print("No author changes detected.")
        return

    papers_processed = 0

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            for item in items:
                data = item.get("data", {})
                item_type = data.get("itemType")

                if item_type in ("attachment", "note", "annotation"):
                    continue

                paper_key = data.get("key")
                if not paper_key:
                    continue

                cur.execute(
                    """
                    SELECT paper_id
                    FROM papers
                    WHERE zotero_key = %s
                    """,
                    (paper_key,),
                )
                paper_row = cur.fetchone()

                if not paper_row:
                    continue

                paper_id = paper_row["paper_id"]

                # Rebuild author links for this paper
                cur.execute(
                    """
                    DELETE FROM paper_authors
                    WHERE paper_id = %s
                    """,
                    (paper_id,),
                )

                creators = data.get("creators", [])

                position = 1
                for creator in creators:
                    if creator.get("creatorType") != "author":
                        continue

                    if creator.get("name"):
                        full_name = creator.get("name").strip()
                        first_name = None
                        last_name = creator.get("name").strip()
                    else:
                        first_name = (creator.get("firstName") or "").strip() or None
                        last_name = (creator.get("lastName") or "").strip() or None
                        full_name = " ".join(
                            part for part in [first_name, last_name] if part
                        ).strip()

                    if not full_name:
                        continue

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

                    cur.execute(
                        """
                        INSERT INTO paper_authors (paper_id, author_id, position)
                        VALUES (%s, %s, %s)
                        ON CONFLICT DO NOTHING
                        """,
                        (paper_id, author_id, position),
                    )
                    position += 1

                papers_processed += 1

            conn.commit()

    print(f"Successfully synced authors for {papers_processed} papers.")