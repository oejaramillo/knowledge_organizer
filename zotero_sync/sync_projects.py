from db import get_db_connection

def sync_projects(client):
    print("Syncing collections to projects...")
    collections = client.get_collections()
    
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Pass 1: Insert/Update basic info
            for col in collections:
                data = col['data']
                cur.execute("""
                    INSERT INTO projects (
                            zotero_collection_key,
                            name,
                            description
                        )
                        VALUES (%s, %s, %s)
                        ON CONFLICT (zotero_collection_key)
                        DO UPDATE SET
                        name = EXCLUDED.name,
                        description = EXCLUDED.description;
                """, (data['key'], data['name'], f"Synced from Zotero collection: {data['name']}"))

            conn.commit()

            # Pass 2: Update hierarchy
            for col in collections:
                data = col['data']
                if data.get('parentCollection'):
                    cur.execute("""
                        UPDATE projects
                            SET parent_project = (
                                SELECT project_id
                                FROM projects
                                WHERE zotero_collection_key = %s
                            )
                            WHERE zotero_collection_key = %s;
                    """, (data['parentCollection'], data['key']))
            
            conn.commit()
            print(f"Successfully synced {len(collections)} projects.")