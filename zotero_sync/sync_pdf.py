"""Refresh ``papers.pdf_path`` from an item's child attachments.

``sync_attachments`` already maintains ``pdf_path`` during a normal sync. This
script is a targeted fallback for when only the PDF paths need to be rebuilt
(for example after moving the Zotero data directory), without running the full
pipeline.

Run it from the ``zotero_sync`` directory:

    python sync_pdf.py
"""

from db import get_db_connection
from zotero_client import ZoteroClient


def extract_pdf_href(item: dict) -> str | None:
    """Return the ``enclosure`` href of a PDF attachment item, if any."""
    data = item.get("data", {})
    if data.get("itemType") != "attachment":
        return None
    if (data.get("contentType") or "").lower() != "application/pdf":
        return None

    links = item.get("links") or {}
    enclosure = links.get("enclosure") if isinstance(links, dict) else None
    if isinstance(enclosure, dict):
        return enclosure.get("href")

    # Older/served payloads may expose the path directly.
    return data.get("path")


def sync_pdf_paths(client=None):
    """Copy each paper's first PDF attachment path into ``papers.pdf_path``."""
    client = client or ZoteroClient()
    print("Syncing PDF paths...")

    updated = 0
    skipped = 0

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT paper_id, zotero_key FROM papers")
            papers = cur.fetchall()

            for paper in papers:
                if not paper["zotero_key"]:
                    skipped += 1
                    continue

                pdf_href = None
                for child in client.get_children(paper["zotero_key"]):
                    pdf_href = extract_pdf_href(child)
                    if pdf_href:
                        break

                if not pdf_href:
                    skipped += 1
                    continue

                cur.execute(
                    """
                    UPDATE papers
                    SET pdf_path = %s, updated_at = NOW()
                    WHERE paper_id = %s
                    """,
                    (pdf_href, paper["paper_id"]),
                )
                updated += 1

        conn.commit()

    print(f"Updated {updated} PDF paths ({skipped} papers without a PDF attachment).")


if __name__ == "__main__":
    sync_pdf_paths()
