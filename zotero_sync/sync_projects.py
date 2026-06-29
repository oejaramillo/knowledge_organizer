from db import get_db_connection


def sync_projects(client, since=None, since_date=None):
    label = (
        f"(incremental since v{since})" if since is not None
        else f"(incremental since {since_date})" if since_date is not None
        else "(full sync)"
    )
    print(f"Syncing collections to projects... {label}")

    collections = client.get_collections(since=since, since_date=since_date)

    if not collections:
        print("No collection changes detected.")
        return

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Pass 1: upsert all projects
            for col in collections:
                data = col.get("data", {})

                cur.execute(
                    """
                    INSERT INTO projects (
                        zotero_collection_key,
                        name,
                        description
                    )
                    VALUES (%s, %s, %s)
                    ON CONFLICT (zotero_collection_key)
                    DO UPDATE SET
                        name = EXCLUDED.name,
                        description = EXCLUDED.description,
                        updated_at = NOW()
                    """,
                    (
                        data.get("key"),
                        data.get("name"),
                        f"Synced from Zotero collection: {data.get('name')}",
                    ),
                )

            # Pass 2: parent hierarchy
            for col in collections:
                data = col.get("data", {})
                parent_key = data.get("parentCollection")
                if not parent_key:
                    continue

                cur.execute(
                    """
                    UPDATE projects
                    SET parent_project = (
                        SELECT project_id
                        FROM projects
                        WHERE zotero_collection_key = %s
                    ),
                    updated_at = NOW()
                    WHERE zotero_collection_key = %s
                    """,
                    (parent_key, data.get("key")),
                )

            conn.commit()

    print(f"Successfully synced {len(collections)} projects.")