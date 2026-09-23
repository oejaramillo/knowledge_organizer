"""Zotero → Postgres synchronisation.

Incremental strategy
--------------------
The sync keeps a change cursor in ``sync_state`` so it can fetch only what
changed. Two kinds of cursor exist, and only one of them is trustworthy on every
Zotero API:

* **library version** (``since=<version>``) — used by the Zotero *web* API;
* **full pass** — fetch everything and upsert.

The Zotero *local* API (10.x) still returns a ``Last-Modified-Version`` header
but ignores ``since=``, answering an empty list for every value. Trusting that
header therefore makes an "incremental" sync a silent no-op that still exits 0
and reports success in the dashboard. The client probes for real ``since``
support (``ZoteroClient.supports_since``) and this module falls back to a full
pass whenever the cursor cannot be trusted, so a Zotero version that lies about
``since`` can never make items disappear.

Every run ends with a machine-readable ``SYNC_SUMMARY`` line so the dashboard can
report what actually happened instead of just "completed".
"""

import argparse
import json
from datetime import datetime, timezone

from zotero_client import ZoteroClient
from db import get_db_connection, get_sync_state, save_sync_state
from sync_projects import sync_projects
from sync_papers import sync_papers
from sync_authors import sync_authors
from sync_attachments import sync_attachments
from sync_annotations import sync_annotations

STEPS = ["projects", "papers", "authors", "attachments", "annotations"]

STEP_FUNCS = {
    "projects": sync_projects,
    "papers": sync_papers,
    "authors": sync_authors,
    "attachments": sync_attachments,
    "annotations": sync_annotations,
}


def reset_sync_state():
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE sync_state
                SET last_library_version = NULL, last_sync = NULL
                WHERE source = %s
                """,
                ("zotero",),
            )
        conn.commit()
    print("Sync state reset — will run a full pass.")


def resolve_mode(args, client, current_version, last_version, last_sync):
    """Decide how much to fetch, and why.

    Returns ``(mode, since_version, since_date, explanation)`` where the cursor
    is either a library version (web API) or a timestamp (local API).
    """
    if args.only:
        return "selective", None, None, None

    if args.full or args.force:
        return "full", None, None, "requested"

    if not client.supports_since():
        # The library version cannot be used as a change cursor here, so fall
        # back to "everything modified since the previous run started". The
        # fetch is cheap; only changed items are written.
        if last_sync is None:
            return "full", None, None, "first sync (this Zotero API has no 'since' cursor)"
        timestamp = last_sync.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        return "timestamp", None, timestamp, None

    if last_sync is None or last_version is None:
        return "full", None, None, "no previous sync"

    if last_version == current_version:
        return "up-to-date", None, None, None

    return "incremental", last_version, None, None


def _emit_summary(meta: dict, counts: dict, version) -> None:
    print("\n==============================")
    print(f"SYNC COMPLETE — {meta.get('label', meta['mode'])}"
          + (f" (library version {version})" if version is not None else ""))
    for step in STEPS:
        if step in counts:
            print(f"  {step:12s} {counts[step]}")
    print("==============================")

    # Machine-readable line consumed by the dashboard (POST /api/tools/zotero-sync)
    print("SYNC_SUMMARY " + json.dumps({
        **meta,
        "library_version": version,
        "counts": counts,
        "total": sum(counts.values()),
    }))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--force', action='store_true',
                        help='Force a full re-sync of all data')
    parser.add_argument('--only', nargs='+', choices=STEPS, metavar='STEP',
                        help=f'Run only specific steps. Choices: {", ".join(STEPS)}')
    parser.add_argument('--full', action='store_true',
                        help='Ignore the version cursor and fetch everything')
    args = parser.parse_args()

    client = ZoteroClient()

    info = client.get_library_info()
    current_version = info["library_version"]

    print(f"Connected to Zotero (API v{info['api_version']})")
    print(f"Current library version: {current_version if current_version is not None else 'N/A'}")

    if args.force:
        reset_sync_state()

    state = get_sync_state()

    mode, since_version, since_date, explanation = resolve_mode(
        args, client, current_version, state["last_library_version"], state["last_sync"]
    )

    if mode == "up-to-date":
        print("Library is up to date. Nothing to sync.")
        print("Tip: use --full, or --only projects papers, to force a fetch anyway.")
        _emit_summary({"mode": "up-to-date"}, {}, current_version)
        return

    if mode == "full" and explanation:
        print(f"Full pass ({explanation}).")

    run = set(args.only) if args.only else set(STEPS)
    if mode == "selective":
        print(f"Selective sync: {', '.join(sorted(run))}")
        print("Note: fetching all items for the selected steps (ignoring the version cursor).")

    sync_started_at = datetime.now(timezone.utc)
    counts: dict[str, int] = {}

    for step in STEPS:
        if step in run:
            counts[step] = STEP_FUNCS[step](client, since=since_version, since_date=since_date) or 0

    # Only advance the cursor on a complete run
    if not args.only:
        save_sync_state(current_version, sync_started_at)

    label = {
        "full": "full pass",
        "incremental": f"incremental from v{since_version}",
        "timestamp": f"incremental from {since_date}",
    }.get(mode, mode)
    _emit_summary({"mode": mode, "label": label}, counts, current_version)


if __name__ == "__main__":
    main()
