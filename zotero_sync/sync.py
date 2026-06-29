from datetime import datetime, timezone

from zotero_client import ZoteroClient
from db import get_sync_state, save_sync_state
from sync_projects import sync_projects
from sync_papers import sync_papers
from sync_authors import sync_authors
from sync_attachments import sync_attachments
from sync_annotations import sync_annotations


def main():
    client = ZoteroClient()

    info = client.get_library_info()
    current_version = info["library_version"]

    print(f"Connected to Zotero (API v{info['api_version']})")
    print(f"Current library version: {current_version or 'N/A (local API)'}")

    state = get_sync_state()
    last_version = state["last_library_version"]
    last_sync = state["last_sync"]

    if last_sync is None:
        print("No previous sync found. Running full sync...")
        since_version = None
        since_date = None
    elif current_version is not None and last_version == current_version:
        print("Library is up to date. Nothing to sync.")
        return
    elif current_version is not None and last_version is not None:
        print(f"Incremental sync: changes since library version {last_version}")
        since_version = last_version
        since_date = None
    else:
        since_date = last_sync.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        print(f"Incremental sync: changes since {since_date} (timestamp fallback)")
        since_version = None

    # Capture sync start time before reading data.
    # This avoids missing updates that happen during the sync run.
    sync_started_at = datetime.now(timezone.utc)

    sync_projects(client, since=since_version, since_date=since_date)
    sync_papers(client, since=since_version, since_date=since_date)
    sync_authors(client, since=since_version, since_date=since_date)
    sync_attachments(client, since=since_version, since_date=since_date)
    sync_annotations(client, since=since_version, since_date=since_date)

    save_sync_state(current_version, sync_started_at)

    print("\n==============================")
    effective = f"v{current_version}" if current_version is not None else "timestamp-based"
    print(f"SYNC COMPLETE ({effective})")
    print("==============================")


if __name__ == "__main__":
    main()