from db import get_db_connection
from utils import announce


def sync_attachments(client, since=None, since_date=None):
    announce("attachments and PDF paths", since=since, since_date=since_date)

    attachments = client.get_attachments(since=since, since_date=since_date)

    if not attachments:
        print("No attachment changes detected.")
        return 0

    synced_attachments = 0
    updated_pdf_paths = 0

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # One lookup for the whole run instead of one SELECT per attachment.
            cur.execute("SELECT zotero_key, paper_id FROM papers WHERE zotero_key IS NOT NULL")
            papers_by_key = {r["zotero_key"]: r["paper_id"] for r in cur.fetchall()}

            rows = []
            pdf_paths = []
            for item in attachments:
                data = item.get("data", {})
                links = item.get("links", {})

                if data.get("itemType") != "attachment":
                    continue

                attachment_key = data.get("key")
                parent_paper_zotero_key = data.get("parentItem")

                if not attachment_key or not parent_paper_zotero_key:
                    continue

                paper_id = papers_by_key.get(parent_paper_zotero_key)
                if not paper_id:
                    continue

                filename = data.get("filename") or data.get("title")
                mime_type = data.get("contentType")
                md5 = data.get("md5")

                file_path = (
                    links.get("enclosure", {}).get("href")
                    if isinstance(links, dict)
                    else None
                )

                rows.append((paper_id, attachment_key, filename, mime_type, file_path, md5))

                if mime_type == "application/pdf" and file_path:
                    pdf_paths.append((file_path, paper_id))

            if rows:
                cur.executemany(
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
                    rows,
                )
                synced_attachments = len(rows)

            if pdf_paths:
                cur.executemany(
                    "UPDATE papers SET pdf_path = %s WHERE paper_id = %s",
                    pdf_paths,
                )
                updated_pdf_paths = len(pdf_paths)

            conn.commit()

    print(f"Successfully synced {synced_attachments} attachments.")
    print(f"Successfully updated {updated_pdf_paths} paper pdf_path values.")
    return synced_attachments