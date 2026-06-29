import os
from contextlib import contextmanager
from datetime import datetime

import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


@contextmanager
def get_db_connection():
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        yield conn


def get_sync_state(source: str = "zotero") -> dict:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT last_library_version, last_sync
                FROM sync_state
                WHERE source = %s
                """,
                (source,),
            )
            row = cur.fetchone()

            if row is None:
                return {
                    "last_library_version": None,
                    "last_sync": None,
                }

            return {
                "last_library_version": row["last_library_version"],
                "last_sync": row["last_sync"],
            }


def save_sync_state(
    version: int | None,
    sync_time: datetime,
    source: str = "zotero",
) -> None:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO sync_state (source, last_library_version, last_sync)
                VALUES (%s, %s, %s)
                ON CONFLICT (source)
                DO UPDATE SET
                    last_library_version = EXCLUDED.last_library_version,
                    last_sync = EXCLUDED.last_sync
                """,
                (source, version, sync_time),
            )
            conn.commit()