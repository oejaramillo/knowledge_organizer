#!/usr/bin/env python
"""Verify that the repo's SQL reproduces the live database exactly.

The script builds a throwaway Postgres schema from
``schema_v2.sql`` + ``migrations/*.sql`` and diffs it against an existing
schema (``public`` by default). Any difference is drift: either the live
database changed without a migration, or a migration is incomplete.

Usage:
    python tools/verify_schema.py                # diff against `public`
    python tools/verify_schema.py --live other   # diff against another schema

Exit code is 0 when the two schemas are identical, 1 otherwise.
"""

import argparse
import os
import re
import sys
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

ROOT_DIR = Path(__file__).resolve().parent.parent
SCRATCH_SCHEMA = "scratch_schema_verify"

# Objects owned by these extensions are not part of the application schema.
EXTENSION_FUNCTIONS = "e"


def normalize(value: str | None, scratch: str) -> str:
    """Strip schema qualification and collapse whitespace for comparison."""
    if value is None:
        return ""
    value = value.replace(f"{scratch}.", "").replace("public.", "")
    return re.sub(r"\s+", " ", value).strip()


def snapshot(cur, schema: str, scratch: str) -> dict:
    data: dict[str, dict] = {}

    cur.execute(
        """
        SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = %s
        ORDER BY table_name, column_name
        """,
        (schema,),
    )
    data["columns"] = {
        (r["table_name"], r["column_name"]): (
            r["data_type"], r["udt_name"], r["is_nullable"], normalize(r["column_default"], scratch)
        )
        for r in cur.fetchall()
    }

    cur.execute(
        """
        SELECT c.relname AS tbl, con.conname, con.contype, pg_get_constraintdef(con.oid) AS def
        FROM pg_constraint con
        JOIN pg_class c ON c.oid = con.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = %s AND con.contype IN ('p', 'f', 'c', 'u')
        ORDER BY 1, 2
        """,
        (schema,),
    )
    data["constraints"] = {
        (r["tbl"], r["conname"]): (r["contype"], normalize(r["def"], scratch))
        for r in cur.fetchall()
    }

    cur.execute(
        """
        SELECT c.relname AS tbl, i.relname AS idx, pg_get_indexdef(ix.indexrelid) AS def
        FROM pg_index ix
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_class c ON c.oid = ix.indrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = %s
        ORDER BY 1, 2
        """,
        (schema,),
    )
    data["indexes"] = {
        (r["tbl"], r["idx"]): normalize(r["def"], scratch) for r in cur.fetchall()
    }

    cur.execute(
        """
        SELECT table_name, view_definition
        FROM information_schema.views
        WHERE table_schema = %s
        ORDER BY table_name
        """,
        (schema,),
    )
    data["views"] = {
        r["table_name"]: normalize(r["view_definition"], scratch) for r in cur.fetchall()
    }

    cur.execute(
        """
        SELECT t.typname, e.enumlabel
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = %s
        ORDER BY t.typname, e.enumsortorder
        """,
        (schema,),
    )
    enums: dict[str, list[str]] = {}
    for r in cur.fetchall():
        enums.setdefault(r["typname"], []).append(r["enumlabel"])
    data["enums"] = enums

    cur.execute(
        """
        SELECT c.relname AS tbl, t.tgname, pg_get_triggerdef(t.oid) AS def
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = %s AND NOT t.tgisinternal
        ORDER BY 1, 2
        """,
        (schema,),
    )
    data["triggers"] = {
        (r["tbl"], r["tgname"]): normalize(r["def"], scratch) for r in cur.fetchall()
    }

    cur.execute(
        """
        SELECT p.proname, pg_get_functiondef(p.oid) AS def
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = %s
          AND NOT EXISTS (
              SELECT 1 FROM pg_depend d
              WHERE d.objid = p.oid AND d.deptype = %s
          )
        ORDER BY 1
        """,
        (schema, EXTENSION_FUNCTIONS),
    )
    data["functions"] = {
        r["proname"]: normalize(r["def"], scratch) for r in cur.fetchall()
    }

    return data


def diff(fresh: dict, live: dict) -> int:
    total = 0
    for section in ("columns", "constraints", "indexes", "views", "enums", "triggers", "functions"):
        f, l = fresh[section], live[section]
        missing = sorted(set(l) - set(f))
        extra = sorted(set(f) - set(l))
        changed = sorted(k for k in set(f) & set(l) if f[k] != l[k])

        if not (missing or extra or changed):
            continue

        print(f"\n--- {section} ---")
        for key in missing:
            print(f"  MISSING in repo : {key}\n      live : {l[key]}")
        for key in extra:
            print(f"  EXTRA in repo   : {key}\n      repo : {f[key]}")
        for key in changed:
            print(f"  DIFFERENT       : {key}\n      live : {l[key]}\n      repo : {f[key]}")
        total += len(missing) + len(extra) + len(changed)

    return total


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", default="public", help="schema to compare against")
    parser.add_argument("--keep", action="store_true", help="keep the scratch schema")
    args = parser.parse_args()

    load_dotenv(ROOT_DIR / ".env")
    url = os.getenv("DATABASE_URL")
    if not url:
        print("DATABASE_URL is not set (see .env.example).", file=sys.stderr)
        return 2

    schema_files = [ROOT_DIR / "schema_v2.sql"]
    schema_files += sorted((ROOT_DIR / "migrations").glob("*.sql"))

    with psycopg.connect(url, row_factory=dict_row, autocommit=True) as conn:
        cur = conn.cursor()
        cur.execute(f"DROP SCHEMA IF EXISTS {SCRATCH_SCHEMA} CASCADE")
        cur.execute(f"CREATE SCHEMA {SCRATCH_SCHEMA}")
        cur.execute(f"SET search_path = {SCRATCH_SCHEMA}, public")

        for path in schema_files:
            cur.execute(path.read_text(encoding="utf-8"))
            print(f"applied {path.name}")

        fresh = snapshot(cur, SCRATCH_SCHEMA, SCRATCH_SCHEMA)
        live = snapshot(cur, args.live, SCRATCH_SCHEMA)

        print(f"\n===== schema diff: repo  vs  {args.live} =====")
        total = diff(fresh, live)

        if not args.keep:
            cur.execute(f"DROP SCHEMA {SCRATCH_SCHEMA} CASCADE")

    if total:
        print(f"\nDRIFT DETECTED: {total} difference(s).")
        return 1

    print("\nOK — the repo reproduces the live schema exactly.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
