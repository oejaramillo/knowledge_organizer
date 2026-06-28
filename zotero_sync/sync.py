from zotero_client import ZoteroClient
from db import get_last_library_version, save_library_version
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
    print(f"Current library version: {current_version}")

    last_version = get_last_library_version()

    if last_version is None:
        print("No previous sync found. Running full sync...")
    elif last_version == current_version:
        print("Library is up to date. Nothing to sync.")
        return
    else:
        print(f"Incremental sync: changes since version {last_version}")

    # Pass since= to every sync function
    # On first run, since=None → full sync
    since = last_version

    sync_projects(client, since=since)
    sync_papers(client, since=since)
    sync_authors(client)
    sync_attachments(client, since=since)
    sync_annotations(client, since=since)

    # Only save the new version after everything succeeds
    save_library_version(current_version)

    print("\n==============================")
    print(f"SYNC COMPLETE  (library v{current_version})")
    print("==============================")


if __name__ == "__main__":
    main()