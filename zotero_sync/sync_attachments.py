from db import get_db_connection


def sync_attachments(client):
    print("Syncing attachments and PDF paths...")
    attachments = client.get_attachments()

    synced_attachments = 0
    updated_pdf_paths = 0

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            for item in attachments:
                data = item.get("data", {})
                links = item.get("links", {})

                if data.get("itemType") != "attachment":
                    continue

                attachment_key = data.get("key")
                parent_paper_zotero_key = data.get("parentItem")
                filename = data.get("filename") or data.get("title")
                mime_type = data.get("contentType")
                md5 = data.get("md5")

                file_path = (
                    links.get("enclosure", {}).get("href")
                    if isinstance(links, dict)
                    else None
                )

                if not attachment_key or not parent_paper_zotero_key:
                    continue

                # Find internal paper_id from Zotero parent paper key
                cur.execute(
                    """
                    SELECT paper_id
                    FROM papers
                    WHERE zotero_key = %s
                    """,
                    (parent_paper_zotero_key,)
                )
                paper_row = cur.fetchone()

                if not paper_row:
                    continue

                paper_id = paper_row["paper_id"]

                # Upsert attachment row
                cur.execute(
                    """
                    INSERT INTO attachments (
                        paper_id,
                        zotero_attachment_key,
                        filename,
                        mime_type,
                        file_path,
                        md5
                    )
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (zotero_attachment_key)
                    DO UPDATE SET
                        paper_id = EXCLUDED.paper_id,
                        filename = EXCLUDED.filename,
                        mime_type = EXCLUDED.mime_type,
                        file_path = EXCLUDED.file_path,
                        md5 = EXCLUDED.md5
                    """,
                    (
                        paper_id,
                        attachment_key,
                        filename,
                        mime_type,
                        file_path,
                        md5,
                    )
                )
                synced_attachments += 1

                # If this is a PDF and we have a real file href, store it in papers.pdf_path too
                if mime_type == "application/pdf" and file_path:
                    cur.execute(
                        """
                        UPDATE papers
                        SET pdf_path = %s
                        WHERE paper_id = %s
                        """,
                        (file_path, paper_id)
                    )
                    updated_pdf_paths += 1

            conn.commit()

    print(f"Successfully synced {synced_attachments} attachments.")
    print(f"Successfully updated {updated_pdf_paths} paper pdf_path values.")