# sync.py
from datetime import datetime, timezone
import argparse

from zotero_client import ZoteroClient
from db import get_db_connection, get_sync_state, save_sync_state
from sync_projects import sync_projects
from sync_papers import sync_papers
from sync_authors import sync_authors
from sync_attachments import sync_attachments
from sync_annotations import sync_annotations


def reset_sync_state():
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE sync_state SET last_library_version = NULL, last_sync = NULL")
        conn.commit()
    print("Sync state reset — will run full sync.")


STEPS = ["projects", "papers", "authors", "attachments", "annotations"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--force', action='store_true',
                        help='Force full re-sync of all data')
    parser.add_argument('--only', nargs='+', choices=STEPS, metavar='STEP',
                        help=f'Run only specific steps. Choices: {", ".join(STEPS)}')
    parser.add_argument('--full', action='store_true',
                        help='Ignore version state and fetch all items (but do not reset sync state)')
    args = parser.parse_args()

    client = ZoteroClient()

    info = client.get_library_info()
    current_version = info["library_version"]

    print(f"Connected to Zotero (API v{info['api_version']})")
    print(f"Current library version: {current_version or 'N/A (local API)'}")

    if args.force:
        reset_sync_state()

    # --full bypasses version check and runs everything with no since filter
    if args.full:
        print("Full fetch requested — syncing all items regardless of version.")
        since_version = None
        since_date = None
    else:
        state = get_sync_state()
        last_version = state["last_library_version"]
        last_sync = state["last_sync"]

        if last_sync is None:
            print("No previous sync found. Running full sync...")
            since_version = None
            since_date = None
        elif current_version is not None and last_version == current_version and not args.only:
            print("Library is up to date. Nothing to sync.")
            print("Tip: use --only projects papers  to force-sync specific steps anyway.")
            return
        elif current_version is not None and last_version is not None:
            print(f"Incremental sync: changes since library version {last_version}")
            since_version = last_version
            since_date = None
        else:
            since_date = last_sync.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            print(f"Incremental sync: changes since {since_date} (timestamp fallback)")
            since_version = None

    # Determine which steps to run
    run = set(args.only) if args.only else set(STEPS)

    # When --only is used with incremental, skip the version-up-to-date bail-out
    # and always pass since=None so Zotero returns ALL items for those steps
    since_v = None if args.only else since_version
    since_d = None if args.only else since_date

    if args.only:
        print(f"Selective sync: {', '.join(sorted(run))}")
        print("Note: fetching all items for selected steps (ignoring version delta).")

    sync_started_at = datetime.now(timezone.utc)

    if "projects"     in run: sync_projects(client,     since=since_v, since_date=since_d)
    if "papers"       in run: sync_papers(client,       since=since_v, since_date=since_d)
    if "authors"      in run: sync_authors(client,      since=since_v, since_date=since_d)
    if "attachments"  in run: sync_attachments(client,  since=since_v, since_date=since_d)
    if "annotations"  in run: sync_annotations(client,  since=since_v, since_date=since_d)

    # Only advance the sync state when doing a full run
    if not args.only:
        save_sync_state(current_version, sync_started_at)

    print("\n==============================")
    effective = f"v{current_version}" if current_version is not None else "timestamp-based"
    print(f"SYNC COMPLETE ({effective})")
    print("==============================")


if __name__ == "__main__":
    main()