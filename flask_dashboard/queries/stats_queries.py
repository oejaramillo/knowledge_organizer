"""Statistics and global-search SQL queries (parameterized)."""


def library_stats(cur, project_id=None):
    """Aggregate library statistics, optionally scoped to one project."""
    # Build a paper-scoping CTE so every count respects the project filter.
    if project_id:
        scope = (
            "WITH scoped AS ("
            "  SELECT p.* FROM papers p "
            "  JOIN paper_projects pp ON pp.paper_id = p.paper_id "
            "  WHERE pp.project_id = %s)"
        )
        scope_params = [project_id]
    else:
        scope = "WITH scoped AS (SELECT * FROM papers)"
        scope_params = []

    cur.execute(
        f"""
        {scope}
        SELECT
            COUNT(*)                                   AS total_papers,
            COUNT(*) FILTER (WHERE is_read)            AS read_papers,
            COUNT(*) FILTER (WHERE NOT is_read)        AS unread_papers,
            COUNT(*) FILTER (WHERE star)               AS starred_papers,
            COUNT(*) FILTER (WHERE status = 'processed') AS processed_papers
        FROM scoped
        """,
        scope_params,
    )
    paper_stats = cur.fetchone()

    # status breakdown
    cur.execute(
        f"{scope} SELECT status, COUNT(*) AS n FROM scoped GROUP BY status",
        scope_params,
    )
    by_status = {r["status"]: r["n"] for r in cur.fetchall()}

    # document type breakdown
    cur.execute(
        f"{scope} SELECT document_type, COUNT(*) AS n FROM scoped "
        f"GROUP BY document_type ORDER BY n DESC",
        scope_params,
    )
    by_doctype = {r["document_type"]: r["n"] for r in cur.fetchall()}

    # papers per year
    cur.execute(
        f"{scope} SELECT year, COUNT(*) AS n FROM scoped "
        f"WHERE year IS NOT NULL GROUP BY year ORDER BY year",
        scope_params,
    )
    by_year = [{"year": r["year"], "count": r["n"]} for r in cur.fetchall()]

    # claims count (scoped)
    cur.execute(
        f"{scope} "
        f"SELECT COUNT(*) AS n, "
        f"COUNT(*) FILTER (WHERE claim_type = 'empirical') AS empirical "
        f"FROM claims cl WHERE cl.paper_id IN (SELECT paper_id FROM scoped)",
        scope_params,
    )
    claim_row = cur.fetchone()

    # annotations count (scoped)
    cur.execute(
        f"{scope} SELECT COUNT(*) AS n FROM annotations an "
        f"WHERE an.paper_id IN (SELECT paper_id FROM scoped)",
        scope_params,
    )
    n_annotations = cur.fetchone()["n"]

    # counts of standalone entities (only when not project-scoped)
    totals = {}
    if not project_id:
        for tbl in ("projects", "authors", "concepts", "methods", "ideas"):
            cur.execute(f"SELECT COUNT(*) AS n FROM {tbl}")
            totals[tbl] = cur.fetchone()["n"]

    return {
        "papers": paper_stats,
        "by_status": by_status,
        "by_document_type": by_doctype,
        "by_year": by_year,
        "claims": {
            "total": claim_row["n"],
            "empirical": claim_row["empirical"],
            "non_empirical": claim_row["n"] - claim_row["empirical"],
        },
        "annotations": n_annotations,
        "totals": totals,
    }


def global_search(cur, q, limit=10):
    """Search across papers, claims, authors, concepts, methods."""
    like = f"%{q}%"
    results = {}

    cur.execute(
        """
        SELECT paper_id, title, year, journal
        FROM papers
        WHERE to_tsvector('english', title || ' ' || coalesce(abstract,''))
              @@ plainto_tsquery('english', %s)
           OR title ILIKE %s
        ORDER BY year DESC NULLS LAST
        LIMIT %s
        """,
        (q, like, limit),
    )
    results["papers"] = cur.fetchall()

    cur.execute(
        """
        SELECT claim_id, paper_id, claim, claim_type
        FROM claims
        WHERE to_tsvector('english', claim) @@ plainto_tsquery('english', %s)
           OR claim ILIKE %s
        LIMIT %s
        """,
        (q, like, limit),
    )
    results["claims"] = cur.fetchall()

    cur.execute(
        """
        SELECT author_id, full_name, institution
        FROM authors WHERE full_name ILIKE %s ORDER BY full_name LIMIT %s
        """,
        (like, limit),
    )
    results["authors"] = cur.fetchall()

    cur.execute(
        """
        SELECT concept_id, name, definition
        FROM concepts WHERE name ILIKE %s OR definition ILIKE %s
        ORDER BY name LIMIT %s
        """,
        (like, like, limit),
    )
    results["concepts"] = cur.fetchall()

    cur.execute(
        """
        SELECT method_id, name, paradigm, tradition
        FROM methods WHERE name ILIKE %s ORDER BY name LIMIT %s
        """,
        (like, limit),
    )
    results["methods"] = cur.fetchall()

    return results
