"""
Main orchestrator. This is the script you run.

Usage:
    # Annotation-driven mode (default) — fast and cheap
    python -m ai_enrichments.enrich

    # Full-text mode — thorough, uses more tokens
    python -m ai_enrichments.enrich --full-text

    # Force re-process already processed papers
    python -m ai_enrichments.enrich --force

    # Process a single paper by zotero_key
    python -m ai_enrichments.enrich --key ABCD1234

    # Use a different provider
    python -m ai_enrichments.enrich --provider openai

    # Dry run — shows what would be processed, writes nothing
    python -m ai_enrichments.enrich --dry-run
"""

import argparse
import sys
import time

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
    paper_id  = str(paper["paper_id"])
    title     = paper["title"]
    abstract  = paper.get("abstract")
    pdf_path  = paper.get("pdf_path")

    print(f"\n  Title    : {title[:80]}")
    print(f"  Paper ID : {paper_id}")

    authors     = get_paper_authors(paper_id)
    annotations = get_paper_annotations(paper_id)

    print(f"  Authors  : {len(authors)}")
    print(f"  Annotations: {len(annotations)}")

    # ── Decide mode ───────────────────────────────────────────────────────────
    pdf_text = None
    if full_text:
        pdf_text = extract_pdf_text(pdf_path)
        if pdf_text:
            print(f"  PDF text : {len(pdf_text):,} chars (full-text mode)")
        else:
            print("  PDF text : not available — falling back to annotation mode")

    if not annotations and not pdf_text and not abstract:
        print("  [skip] No annotations, no PDF text, no abstract — nothing to enrich.")
        return False

    # ── Build prompt ──────────────────────────────────────────────────────────
    user_prompt = build_user_prompt(
        title=title,
        abstract=abstract,
        authors=authors,
        annotations=annotations,
        pdf_text=pdf_text,
        max_claims=MAX_CLAIMS,
    )

    if dry_run:
        print(f"  [dry-run] Would send {len(user_prompt):,} chars to {provider.name}")
        return True

    # ── Call AI ───────────────────────────────────────────────────────────────
    print(f"  Sending to {provider.name}...")
    try:
        raw = provider.complete(SYSTEM_PROMPT, user_prompt)
    except Exception as exc:
        print(f"  [error] AI call failed: {exc}")
        return False

    # ── Parse ─────────────────────────────────────────────────────────────────
    try:
        parsed = parse_response(raw)
    except ParseError as exc:
        print(f"  [error] Parse failed: {exc}")
        return False

    # ── Write ─────────────────────────────────────────────────────────────────
    try:
        counts = write_enrichment(paper_id, parsed)
    except Exception as exc:
        print(f"  [error] DB write failed: {exc}")
        return False

    print(
        f"  ✓ claims={counts['claims']}  "
        f"concepts={counts['concepts']}  "
        f"methods={counts['methods']}  "
        f"variables={counts['variables']}"
    )
    return True


def main():
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

    provider = get_provider(args.provider)

    # ── Fetch papers ──────────────────────────────────────────────────────────
    all_papers = get_papers_to_enrich(force=args.force)

    if args.key:
        papers = [p for p in all_papers if p.get("zotero_key") == args.key]
        if not papers:
            print(f"No paper found with zotero_key='{args.key}'.")
            sys.exit(1)
    else:
        papers = all_papers

    mode = "full-text" if args.full_text else "annotation-driven"
    print(f"\n{'='*50}")
    print(f"AI ENRICHMENT  |  provider={provider.name}  |  mode={mode}")
    print(f"Papers to process: {len(papers)}")
    if args.dry_run:
        print("DRY RUN — no AI calls, no DB writes")
    print(f"{'='*50}")

    succeeded = 0
    failed    = 0
    skipped   = 0

    for i, paper in enumerate(papers, 1):
        print(f"\n[{i}/{len(papers)}]")
        result = enrich_paper(
            paper=paper,
            provider=provider,
            full_text=args.full_text,
            dry_run=args.dry_run,
        )
        if result is True:
            succeeded += 1
        elif result is False:
            failed += 1
        else:
            skipped += 1

        # Rate limit courtesy pause between papers
        if i < len(papers) and not args.dry_run:
            time.sleep(args.delay)

    print(f"\n{'='*50}")
    print(f"ENRICHMENT COMPLETE")
    print(f"  Succeeded : {succeeded}")
    print(f"  Failed    : {failed}")
    print(f"  Skipped   : {skipped}")
    print(f"{'='*50}\n")


if __name__ == "__main__":
    main()