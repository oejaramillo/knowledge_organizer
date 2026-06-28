import os
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


@contextmanager
def get_db_connection():
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        yield conn


def get_last_library_version(source: str = "zotero") -> int | None:
    """
    Returns the last synced library version for a given source.
    Returns None if this is the first sync.
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT last_library_version
                FROM sync_state
                WHERE source = %s
                """,
                (source,)
            )
            row = cur.fetchone()
            if row is None:
                return None
            return row["last_library_version"]


def save_library_version(version: int, source: str = "zotero") -> None:
    """
    Upserts the last synced library version for a given source.
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO sync_state (source, last_library_version, last_sync)
                VALUES (%s, %s, NOW())
                ON CONFLICT (source)
                DO UPDATE SET
                    last_library_version = EXCLUDED.last_library_version,
                    last_sync = NOW()
                """,
                (source, version)
            )
            conn.commit()