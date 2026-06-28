from db import get_db_connection


def sync_projects(client, since=None):
    label = f"(incremental since v{since})" if since is not None else "(full sync)"
    print(f"Syncing collections to projects... {label}")

    collections = client.get_collections(since=since)

    if not collections:
        print("No collection changes detected.")
        return

    with get_db_connection() as conn:
        with conn.cursor() as cur:

            # Pass 1: upsert all collections without parent links
            for col in collections:
                data = col.get("data", {})
                cur.execute(
                    """
                    INSERT INTO projects (name, zotero_collection_key)
                    VALUES (%s, %s)
                    ON CONFLICT (zotero_collection_key)
                    DO UPDATE SET
                        name = EXCLUDED.name,
                        updated_at = NOW()
                    """,
                    (data.get("name"), data.get("key"))
                )

            # Pass 2: resolve parent relationships
            for col in collections:
                data = col.get("data", {})
                parent_key = data.get("parentCollection")
                if not parent_key:
                    continue

                cur.execute(
                    """
                    UPDATE projects
                    SET parent_project = (
                        SELECT project_id FROM projects
                        WHERE zotero_collection_key = %s
                    )
                    WHERE zotero_collection_key = %s
                    """,
                    (parent_key, data.get("key"))
                )

            conn.commit()

    print(f"Successfully synced {len(collections)} projects.")