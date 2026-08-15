# ============================================================================
# AI ENRICHMENT PIPELINE - MAIN ORCHESTRATOR
# ============================================================================
# This is the primary script for running AI-powered content enrichment on
# research papers in the database. It extracts structured knowledge from
# academic papers using large language models.
#
# PROCESSING MODES:
# 1. ANNOTATION-DRIVEN (default): Uses Zotero highlights and notes
#    - Fast and cost-effective
#    - Good for papers already read and annotated
#
# 2. FULL-TEXT MODE: Processes complete PDF content  
#    - Comprehensive but uses more tokens/costs more
#    - Better for systematic extraction from unread papers
#
# WORKFLOW:
# 1. Query database for papers needing enrichment
# 2. Extract content (annotations and/or full text)
# 3. Send structured prompts to AI provider
# 4. Parse AI response into database-ready format
# 5. Write extracted claims, concepts, methods, variables to database
#
# Usage:
#    # Annotation-driven mode (default) — fast and cheap
#    python -m ai_enrichments.enrich
#
#    # Full-text mode — thorough, uses more tokens
#    python -m ai_enrichments.enrich --full-text
#
#    # Force re-process already processed papers
#    python -m ai_enrichments.enrich --force
#
#    # Process a single paper by zotero_key
#    python -m ai_enrichments.enrich --key ABCD1234
#
#    # Use a different provider
#    python -m ai_enrichments.enrich --provider openai
#
#    # Dry run — shows what would be processed, writes nothing
#    python -m ai_enrichments.enrich --dry-run
# ============================================================================

import argparse
import sys
import time

# Import internal modules for the enrichment pipeline
from .extractor import (
    get_papers_to_enrich,
    get_paper_authors,
    get_paper_annotations,
    extract_pdf_text,
)
from .prompts import SYSTEM_PROMPT, build_user_prompt
from .parser import parse_response, ParseError
from .writer import write_enrichment
from .config import MAX_CLAIMS


def get_provider(name: str):
    """
    Factory function to instantiate AI providers.
    
    Supports multiple AI providers through a common interface, allowing
    easy switching between different models and cost optimization.
    
    Args:
        name (str): Provider name - either "deepseek" or "openai"
    
    Returns:
        AIProvider: Configured provider instance
        
    Raises:
        SystemExit: If provider name is not recognized
    """
    if name == "deepseek":
        from .providers.deepseek import DeepSeekProvider
        return DeepSeekProvider()
    elif name == "openai":
        from .providers.openai import OpenAIProvider
        return OpenAIProvider()
    else:
        print(f"Unknown provider: {name}. Choose 'deepseek' or 'openai'.")
        sys.exit(1)


def enrich_paper(paper: dict, provider, full_text: bool, dry_run: bool) -> bool:
    """
    Process a single paper through the AI enrichment pipeline.
    
    This is the core function that handles the complete enrichment workflow
    for one paper using zotero key:
    
    1. Extract paper metadata and content (annotations/full-text)
    2. Build structured prompt for AI model
    3. Send request to AI provider
    4. Parse and validate response
    5. Write extracted knowledge to database
    
    Args:
        paper (dict): Paper record from database with metadata
        provider (AIProvider): Configured AI provider instance
        full_text (bool): Whether to extract and process full PDF text
        dry_run (bool): If True, show what would be processed without AI calls, not usefull in frontend
    
    Returns:
        bool: True if processing succeeded, False if failed or skipped
    """
    # Extract paper metadata for processing
    paper_id  = str(paper["paper_id"])
    title     = paper["title"]
    abstract  = paper.get("abstract")
    pdf_path  = paper.get("pdf_path")

    print(f"\n  Title    : {title[:80]}")
    print(f"  Paper ID : {paper_id}")

    # Fetch related data from database
    authors     = get_paper_authors(paper_id)
    annotations = get_paper_annotations(paper_id)

    print(f"  Authors  : {len(authors)}")
    print(f"  Annotations: {len(annotations)}")

    # ── CONTENT EXTRACTION LOGIC ─────────────────────────────────────────────
    # Determine processing mode and extract appropriate content
    pdf_text = None
    if full_text:
        # Full-text mode: attempt to extract complete PDF content
        pdf_text = extract_pdf_text(pdf_path)
        if pdf_text:
            print(f"  PDF text : {len(pdf_text):,} chars (full-text mode)")
        else:
            print("  PDF text : not available — falling back to annotation mode")

    # Skip papers with no processable content
    if not annotations and not pdf_text and not abstract:
        print("  [skip] No annotations, no PDF text, no abstract — nothing to enrich.")
        return False

    # ── PROMPT CONSTRUCTION ──────────────────────────────────────────────────
    # Build structured prompt combining paper metadata and content
    user_prompt = build_user_prompt(
        title=title,
        abstract=abstract,
        authors=authors,
        annotations=annotations,
        pdf_text=pdf_text,
        max_claims=MAX_CLAIMS,
    )

    # Dry run mode: show processing stats without actual AI calls
    if dry_run:
        print(f"  [dry-run] Would send {len(user_prompt):,} chars to {provider.name}")
        return True

    # ── AI PROCESSING ────────────────────────────────────────────────────────
    # Send prompt to AI provider and handle potential failures
    print(f"  Sending to {provider.name}...")
    try:
        raw = provider.complete(SYSTEM_PROMPT, user_prompt)
    except Exception as exc:
        print(f"  [error] AI call failed: {exc}")
        return False

    # ── RESPONSE PARSING ─────────────────────────────────────────────────────
    # Parse structured JSON response from AI into database-ready format
    try:
        parsed = parse_response(raw)
    except ParseError as exc:
        print(f"  [error] Parse failed: {exc}")
        return False

    # ── DATABASE PERSISTENCE ─────────────────────────────────────────────────
    # Write extracted knowledge to database within a transaction
    try:
        counts = write_enrichment(paper_id, parsed)
    except Exception as exc:
        print(f"  [error] DB write failed: {exc}")
        return False

    # Report success with processing statistics
    print(
        f"  ✓ claims={counts['claims']}  "
        f"concepts={counts['concepts']}  "
        f"methods={counts['methods']}  "
        f"variables={counts['variables']}"
    )
    return True


def main():
    """
    Main entry point for the AI enrichment pipeline.
    
    Handles command-line arguments, fetches papers to process,
    and orchestrates the enrichment workflow with proper error handling
    and progress reporting.
    """
    # ── COMMAND LINE ARGUMENT PARSING ────────────────────────────────────────
    parser = argparse.ArgumentParser(
        description="AI enrichment pipeline for the knowledge management system."
    )
    parser.add_argument(
        "--provider",
        default="deepseek",
        choices=["deepseek", "openai"],
        help="AI provider to use (default: deepseek)",
    )
    parser.add_argument(
        "--full-text",
        action="store_true",
        help="Extract and send full PDF text (more thorough, uses more tokens)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-process papers already marked as processed",
    )
    parser.add_argument(
        "--key",
        type=str,
        default=None,
        help="Process a single paper by its Zotero key",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be processed without calling the AI or writing to DB",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.0,
        help="Seconds to wait between papers (default: 1.0, avoids rate limits)",
    )
    args = parser.parse_args()

    # Initialize AI provider
    provider = get_provider(args.provider)

    # ── PAPER SELECTION LOGIC ────────────────────────────────────────────────
    # Fetch papers that need processing based on command-line options
    all_papers = get_papers_to_enrich(force=args.force)

    if args.key:
        # Single paper mode: process only the specified paper
        papers = [p for p in all_papers if p.get("zotero_key") == args.key]
        if not papers:
            print(f"No paper found with zotero_key='{args.key}'.")
            sys.exit(1)
    else:
        # Batch mode: process all eligible papers
        papers = all_papers

    # ── PROCESSING SETUP AND REPORTING ───────────────────────────────────────
    mode = "full-text" if args.full_text else "annotation-driven"
    print(f"\n{'='*50}")
    print(f"AI ENRICHMENT  |  provider={provider.name}  |  mode={mode}")
    print(f"Papers to process: {len(papers)}")
    if args.dry_run:
        print("DRY RUN — no AI calls, no DB writes")
    print(f"{'='*50}")

    # Initialize processing counters
    succeeded = 0
    failed    = 0
    skipped   = 0

    # ── MAIN PROCESSING LOOP ──────────────────────────────────────────────────
    # Process each paper with error handling and rate limiting
    for i, paper in enumerate(papers, 1):
        print(f"\n[{i}/{len(papers)}]")
        
        # Process individual paper and track results
        result = enrich_paper(
            paper=paper,
            provider=provider,
            full_text=args.full_text,
            dry_run=args.dry_run,
        )
        
        # Update counters based on processing result
        if result is True:
            succeeded += 1
        elif result is False:
            failed += 1
        else:
            skipped += 1

        # Rate limiting: pause between papers to avoid API limits
        if i < len(papers) and not args.dry_run:
            time.sleep(args.delay)

    # ── FINAL REPORTING ──────────────────────────────────────────────────────
    print(f"\n{'='*50}")
    print(f"ENRICHMENT COMPLETE")
    print(f"  Succeeded : {succeeded}")
    print(f"  Failed    : {failed}")
    print(f"  Skipped   : {skipped}")
    print(f"{'='*50}\n")


if __name__ == "__main__":
    main()