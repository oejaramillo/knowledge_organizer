# ============================================================================
# AI ENRICHMENT PIPELINE - DATA EXTRACTION MODULE
# ============================================================================
# This module handles all data extraction operations for the AI enrichment
# pipeline. It interfaces with the database to fetch papers and related
# information, and optionally extracts text content from PDF files.
#
# KEY FUNCTIONS:
# 1. Query database for papers needing AI processing
# 2. Extract paper metadata (authors, annotations)  
# 3. Extract full text from PDF files using pdfminer
# 4. Handle content truncation to stay within model limits
# ============================================================================

import sys
from pathlib import Path

# Import database connection utilities from zotero sync module
from zotero_sync.db import get_db_connection
from .config import MAX_PDF_CHARS


def get_papers_to_enrich(force: bool = False) -> list[dict]:
    """
    Query database for papers that need AI enrichment processing.
    
    Returns papers based on their processing status. By default, only
    returns papers that haven't been processed yet to avoid duplicate work.
    
    Args:
        force (bool): If True, return ALL papers regardless of status.
                     If False, return only unprocessed papers.
    
    Returns:
        list[dict]: List of paper records with metadata including:
                   - paper_id: Unique identifier
                   - title: Paper title
                   - abstract: Paper abstract (if available)
                   - pdf_path: Path to PDF file (if available)
                   - zotero_key: Zotero reference key
                   - status: Processing status
    
    Note:
        Papers are ordered by publication year (newest first) to prioritize
        recent research for processing.
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            if force:
                # Force mode: process all papers regardless of status
                # Useful for reprocessing with updated prompts or models
                cur.execute(
                    """
                    SELECT paper_id, title, abstract, pdf_path, zotero_key, status
                    FROM papers
                    ORDER BY year DESC NULLS LAST
                    """
                )
            else:
                # Normal mode: only process unprocessed papers
                # Avoids duplicate work and respects existing processing
                cur.execute(
                    """
                    SELECT paper_id, title, abstract, pdf_path, zotero_key, status
                    FROM papers
                    WHERE status != 'processed'
                    ORDER BY year DESC NULLS LAST
                    """
                )
            return cur.fetchall()


def get_paper_authors(paper_id: str) -> list[str]:
    """
    Fetch author names for a specific paper in correct order.
    
    Authors are essential context for AI processing as they help
    identify research traditions, institutions, and methodological
    approaches that inform content extraction, thats why are part of.
    
    Args:
        paper_id (str): Unique paper identifier
    
    Returns:
        list[str]: Ordered list of author full names
                  (first author first, as stored in position field)
    """
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
    """
    Fetch all annotations (highlights and notes) for a specific paper.
    
    Annotations are a key source of content for the annotation-driven
    processing mode. They represent my focused attention
    on specific passages and insights.
    
    Args:
        paper_id (str): Unique paper identifier
    
    Returns:
        list[dict]: List of annotation records containing:
                   - annotation_id: Unique identifier
                   - annotation_type: Type (highlight, note, etc.)
                   - page_number: Page where annotation appears
                   - highlight_text: Selected text content
                   - user_note: User's commentary on the highlight
                   - color: Highlight color (organizational system)
    
    Note:
        Results are ordered by page number to maintain document flow.
        Only annotations with actual content are returned.
    """
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
    Extract plain text content from PDF files for full-text processing.
    
    This function handles the complete PDF text extraction workflow:
    1. Validates file existence and accessibility
    2. Uses pdfminer library for robust text extraction
    3. Truncates content to stay within model context limits
    4. Handles various error conditions gracefully
    
    Args:
        pdf_path (str | None): Path to PDF file, may include file:// URI scheme
    
    Returns:
        str | None: Extracted text content, truncated to MAX_PDF_CHARS.
                   Returns None if file doesn't exist, can't be read,
                   or pdfminer is not installed.
    
    Error Handling:
        - Missing/invalid path: Returns None
        - File not found: Logs warning, returns None
        - pdfminer not installed: Logs installation instructions
        - PDF parsing errors: Logs error details, returns None
    
    Note:
        Text is truncated to MAX_PDF_CHARS (400k chars) to prevent
        exceeding model context limits and control processing costs.
        NOT TESTED, due to encoding problems with pdf path that I still could
        not solve
    """
    if not pdf_path:
        return None

    # Handle Zotero Local API file:// URI scheme
    # The Local API returns file paths with file:// prefix that needs stripping
    if pdf_path.startswith("file://"):
        pdf_path = pdf_path[7:]

    # Validate file existence before attempting extraction
    path = Path(pdf_path)
    if not path.exists():
        print(f"  [warn] PDF not found: {pdf_path}", file=sys.stderr)
        return None

    try:
        # Use pdfminer for robust text extraction
        # pdfminer handles various PDF formats and encodings better than alternatives
        from pdfminer.high_level import extract_text
        text = extract_text(str(path))
        
        # Handle empty or whitespace-only extraction
        if not text:
            return None
            
        text = text.strip()
        
        # Truncate content to stay within model context limits
        if len(text) > MAX_PDF_CHARS:
            print(
                f"  [info] PDF truncated from {len(text):,} "
                f"to {MAX_PDF_CHARS:,} chars"
            )
            text = text[:MAX_PDF_CHARS]
            
        return text
        
    except ImportError:
        # Handle missing pdfminer dependency gracefully
        print(
            "  [warn] pdfminer.six not installed. "
            "Run: pip install pdfminer.six",
            file=sys.stderr,
        )
        return None
        
    except Exception as exc:
        # Handle any other PDF extraction errors
        print(f"  [warn] PDF extraction failed: {exc}", file=sys.stderr)
        return None