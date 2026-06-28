from zotero_client import ZoteroClient
from sync_projects import sync_projects
from sync_papers import sync_papers
from sync_authors import sync_authors
from sync_attachments import sync_attachments
from sync_annotations import sync_annotations


def main():
    client = ZoteroClient()

    info = client.get_library_info()
    print(f"Connected to Zotero (API v{info['api_version']})")

    sync_projects(client)
    sync_papers(client)
    sync_authors(client)
    
    sync_attachments(client)
    sync_annotations(client)

    print("\n==============================")
    print("DATABASE FULLY SYNCHRONIZED")
    print("==============================")


if __name__ == "__main__":
    main()