import re
from db import get_db_connection

def extract_year(date_str):
    if not date_str:
        return None
    # Matches the first 4-digit number (e.g., "2023-10-01" or "Spring 2023")
    match = re.search(r'\d{4}', date_str)
    return int(match.group(0)) if match else None

def sync_papers(client):
    print("Syncing papers...")
    items = client.get_top_level_items()
    
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            for item in items:
                data = item['data']
                
                # We only want actual documents, not notes or attachments
                # (get_top_level_items usually handles this, but we filter just in case)
                if data.get('itemType') in ['attachment', 'note']:
                    continue

                # 1. Upsert the Paper
                cur.execute("""
                    INSERT INTO papers (
                        title, doi, zotero_key, year, journal, 
                        abstract, url, document_type, status
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'unread')
                    ON CONFLICT (zotero_key) 
                    DO UPDATE SET 
                        title = EXCLUDED.title,
                        doi = EXCLUDED.doi,
                        year = EXCLUDED.year,
                        journal = EXCLUDED.journal,
                        abstract = EXCLUDED.abstract,
                        url = EXCLUDED.url,
                        document_type = EXCLUDED.document_type
                    RETURNING paper_id;
                """, (
                    data.get('title'),
                    data.get('DOI'),
                    data.get('key'),
                    extract_year(data.get('date')),
                    data.get('publicationTitle') or data.get('university'),
                    data.get('abstractNote'),
                    data.get('url'),
                    # Simple mapping for now, can be expanded
                    'journal_article' if data.get('itemType') == 'journalArticle' else 'other'
                ))
                
                paper_id = cur.fetchone()['paper_id']

                # 2. Link to Projects (Paper-Project Relationships)
                # Zotero items have a 'collections' list of keys
                for col_key in data.get('collections', []):
                    cur.execute("""
                        INSERT INTO paper_projects (paper_id, project_id)
                        SELECT %s, project_id FROM projects WHERE zotero_collection_key = %s
                        ON CONFLICT DO NOTHING;
                    """, (paper_id, col_key))

            conn.commit()
            print(f"Successfully synced {len(items)} items/papers.")