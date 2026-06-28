from zotero_client import ZoteroClient
from sync_projects import sync_projects
from sync_papers import sync_papers
from sync_authors import sync_authors

def main():
    client = ZoteroClient()
    
    # Phase 1: Ingestion
    sync_projects(client)
    sync_papers(client)
    sync_authors(client)
    
    print("\n" + "="*30)
    print("ALL CORE METADATA SYNCED")
    print("="*30)

if __name__ == "__main__":
    main()