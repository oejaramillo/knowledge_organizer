from db import get_db_connection
from utils import announce


def sync_projects(client, since=None, since_date=None):
    announce("collections to projects", since=since, since_date=since_date)

    collections = client.get_collections(since=since, since_date=since_date)

    if not collections:
        print("No collection changes detected.")
        return 0

    # Zotero does not expose a `dateModified` for collections, so they are all
    # re-sent on every pass. Count only the rows that really changed so the
    # dashboard reports meaningful numbers instead of "31 collections" forever.
    changed = 0

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Pass 1: insert new collections, rename existing ones
            for col in collections:
                data = col.get("data", {})
                if not data.get("key"):
                    continue

                cur.execute(
                    """
                    INSERT INTO projects (zotero_collection_key, name)
                    VALUES (%s, %s)
                    ON CONFLICT (zotero_collection_key)
                    DO UPDATE SET
                        name = EXCLUDED.name,
                        updated_at = NOW()
                    WHERE projects.name IS DISTINCT FROM EXCLUDED.name
                    RETURNING project_id
                    """,
                    (data.get("key"), data.get("name")),
                )
                if cur.fetchone():
                    changed += 1

            # Pass 2: parent hierarchy
            for col in collections:
                data = col.get("data", {})
                parent_key = data.get("parentCollection")
                if not parent_key or not data.get("key"):
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
                      AND parent_project IS DISTINCT FROM (
                        SELECT project_id
                        FROM projects
                        WHERE zotero_collection_key = %s
                      )
                    """,
                    (parent_key, data.get("key"), parent_key),
                )
                changed += cur.rowcount

            conn.commit()

    print(f"Checked {len(collections)} collections, {changed} new or updated.")
    return changed
