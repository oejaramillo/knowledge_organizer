from db import get_db_connection

def sync_authors(client):
    print("Syncing authors and links...")
    items = client.get_top_level_items()
    
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            for item in items:
                paper_key = item['data']['key']
                creators = item['data'].get('creators', [])
                
                # Get our paper_id for this Zotero key
                cur.execute("SELECT paper_id FROM papers WHERE zotero_key = %s", (paper_key,))
                res = cur.fetchone()
                if not res: continue
                paper_id = res['paper_id']

                # Clean existing authors for this paper before re-linking 
                # (Prevents primary key errors on re-sync)
                cur.execute("DELETE FROM paper_authors WHERE paper_id = %s", (paper_id,))

                for idx, creator in enumerate(creators):
                    # We usually only want 'author', but could include 'editor' etc.
                    if creator.get('creatorType') != 'author':
                        continue
                        
                    first_name = creator.get('firstName', '')
                    last_name = creator.get('lastName', '')
                    full_name = f"{first_name} {last_name}".strip()

                    # 1. Upsert Author
                    cur.execute("""
                        INSERT INTO authors (full_name, first_name, last_name)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (full_name) DO UPDATE SET
                            first_name = EXCLUDED.first_name,
                            last_name = EXCLUDED.last_name
                        RETURNING author_id;
                    """, (full_name, first_name, last_name))
                    
                    author_id = cur.fetchone()['author_id']

                    # 2. Link Author to Paper with position
                    cur.execute("""
                        INSERT INTO paper_authors (paper_id, author_id, position)
                        VALUES (%s, %s, %s)
                        ON CONFLICT DO NOTHING;
                    """, (paper_id, author_id, idx + 1))

            conn.commit()
            print("Successfully synced authors and linked them to papers.")