"""
Loads paper data from the database and optionally extracts PDF text.
"""

import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

from zotero_sync.db import get_db_connection
from .config import MAX_PDF_CHARS


def normalize_pdf_path(pdf_path: str | None) -> Path | None:
    """Turn a Zotero ``pdf_path`` value into a filesystem path.

    Zotero stores attachments as ``file://`` URIs with percent-encoded
    characters (spaces, accents, ...), so the value coming from the database has
    to be both scheme-stripped *and* URL-decoded before it can be opened.
    Plain filesystem paths are returned unchanged.
    """
    if not pdf_path:
        return None

    value = str(pdf_path).strip()
    if value.startswith("file://"):
        parsed = urlparse(value)
        value = unquote(parsed.path or "")
    else:
        value = unquote(value)

    return Path(value) if value else None


def get_papers_to_enrich(force: bool = False) -> list[dict]:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            if force:
                cur.execute(
                    """
                    SELECT paper_id, title, abstract, pdf_path, zotero_key, status, document_type
                    FROM papers
                    WHERE is_read = true
                    ORDER BY year DESC NULLS LAST
                    """
                )
            else:
                cur.execute(
                    """
                    SELECT paper_id, title, abstract, pdf_path, zotero_key, status, document_type
                    FROM papers
                    WHERE is_read = true
                      AND (status IS NULL OR status != 'processed')
                    ORDER BY year DESC NULLS LAST
                    """
                )
            return cur.fetchall()


def get_paper_authors(paper_id: str) -> list[str]:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT a.full_name
                FROM authors a
                JOIN paper_authors pa ON a.author_id = pa.author_id
                WHERE pa.paper_id = %s
                ORDER BY pa.position
                """,
                (paper_id,),
            )
            return [row["full_name"] for row in cur.fetchall()]


def get_paper_annotations(paper_id: str) -> list[dict]:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    annotation_id,
                    annotation_type,
                    page_number,
                    highlight_text,
                    user_note,
                    color
                FROM annotations
                WHERE paper_id = %s
                  AND (highlight_text IS NOT NULL OR user_note IS NOT NULL)
                ORDER BY page_number NULLS LAST, annotation_sort_index NULLS LAST
                """,
                (paper_id,),
            )
            return cur.fetchall()


def extract_pdf_text(pdf_path: str | None) -> str | None:
    """
    Extracts plain text from a PDF file.
    Returns None if the path is missing, the file doesn't exist,
    or pdfminer is not installed.
    Truncates to MAX_PDF_CHARS to stay within model context limits.
    """
    if not pdf_path:
        return None

    path = normalize_pdf_path(pdf_path)
    if path is None:
        return None

    if not path.exists():
        print(f"  [warn] PDF not found: {path}", file=sys.stderr)
        return None

    try:
        from pdfminer.high_level import extract_text
        text = extract_text(str(path))
        if not text:
            return None
        text = text.strip()
        if len(text) > MAX_PDF_CHARS:
            print(
                f"  [info] PDF truncated from {len(text):,} "
                f"to {MAX_PDF_CHARS:,} chars"
            )
            text = text[:MAX_PDF_CHARS]
        return text
    except ImportError:
        print(
            "  [warn] pdfminer.six not installed. "
            "Run: pip install pdfminer.six",
            file=sys.stderr,
        )
        return None
    except Exception as exc:
        print(f"  [warn] PDF extraction failed: {exc}", file=sys.stderr)
        return None