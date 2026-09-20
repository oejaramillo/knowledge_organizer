"""Database bootstrap.

Creates the base schema (``schema_v2.sql``) and then applies every migration in
``migrations/`` in filename order. The migrations are idempotent
(``IF NOT EXISTS`` / ``CREATE OR REPLACE``), so this is safe to re-run against an
existing database.

Usage:
    python app.py
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

ROOT_DIR = Path(__file__).resolve().parent
SCHEMA_PATH = ROOT_DIR / "schema_v2.sql"
MIGRATIONS_DIR = ROOT_DIR / "migrations"

DATABASE_URL = os.getenv("DATABASE_URL")
# Example: postgresql://user:password@localhost:5432/research_db

engine = create_engine(DATABASE_URL, echo=False) if DATABASE_URL else None


def _run_sql_file(path: Path) -> None:
    """Execute a .sql file inside a single transaction."""
    with engine.begin() as conn:
        conn.execute(text(path.read_text(encoding="utf-8")))


def init_db(schema_path: str | Path | None = None) -> None:
    """Create the base schema and bring it up to date with every migration."""
    if engine is None:
        raise RuntimeError(
            "DATABASE_URL is not set. Add it to the project .env file "
            "(see .env.example)."
        )

    _run_sql_file(Path(schema_path) if schema_path else SCHEMA_PATH)
    print(f"Base schema applied from {SCHEMA_PATH.name}.")

    if MIGRATIONS_DIR.is_dir():
        for migration in sorted(MIGRATIONS_DIR.glob("*.sql")):
            _run_sql_file(migration)
            print(f"Migration applied: {migration.name}")

    print("Schema initialized.")


if __name__ == "__main__":
    init_db()
