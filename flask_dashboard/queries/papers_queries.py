"""Paper-related SQL queries (parameterized)."""


def list_papers(cur, *, project_id=None, author_id=None, method_id=None,
                concept_id=None, is_read=None, star=None, status=None,
                search=None, limit=25, offset=0):
    """List papers with rich filtering. Returns (rows, total)."""
    joins = []
    where = []
    params = []

    if project_id:
        joins.append("JOIN paper_projects pp ON pp.paper_id = p.paper_id")
        where.append("pp.project_id = %s")
        params.append(project_id)
    if author_id:
        joins.append("JOIN paper_authors pa ON pa.paper_id = p.paper_id")
        where.append("pa.author_id = %s")
        params.append(author_id)
    if method_id:
        joins.append("JOIN paper_methods pm ON pm.paper_id = p.paper_id")
        where.append("pm.method_id = %s")
        params.append(method_id)
    if concept_id:
        joins.append("JOIN paper_concepts pc ON pc.paper_id = p.paper_id")
        where.append("pc.concept_id = %s")
        params.append(concept_id)
    if is_read is not None:
        where.append("p.is_read = %s")
        params.append(is_read)
    if star is not None:
        where.append("p.star = %s")
        params.append(star)
    if status:
        where.append("p.status = %s")
        params.append(status)
    if search:
        # Combine full-text search on title/abstract with trigram fallback.
        where.append(
            "(to_tsvector('english', p.title || ' ' || coalesce(p.abstract,'')) "
            "@@ plainto_tsquery('english', %s) OR p.title ILIKE %s)"
        )
        params.extend([search, f"%{search}%"])

    join_sql = " ".join(dict.fromkeys(joins))  # dedupe while preserving order
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""

    cur.execute(
        f"SELECT COUNT(DISTINCT p.paper_id) AS c FROM papers p {join_sql} {where_sql}",
        params,
    )
    total = cur.fetchone()["c"]

    cur.execute(
        f"""
        SELECT DISTINCT
            p.paper_id, p.title, p.year, p.journal, p.doi,
            p.document_type, p.discipline, p.theoretical_framework,
            p.status, p.is_read, p.star, p.citation_intent,
            p.created_at, p.updated_at,
            (SELECT string_agg(a.full_name, ', ' ORDER BY pa2.position)
                 FROM paper_authors pa2
                 JOIN authors a ON a.author_id = pa2.author_id
                 WHERE pa2.paper_id = p.paper_id) AS authors
        FROM papers p
        {join_sql}
        {where_sql}
        ORDER BY p.year DESC NULLS LAST, p.title
        LIMIT %s OFFSET %s
        """,
        params + [limit, offset],
    )
    return cur.fetchall(), total


def get_paper_core(cur, paper_id):
    """Aggregated paper row from the v_paper_full view + raw editable fields."""
    cur.execute(
        """
        SELECT vf.*, p.abstract, p.is_read, p.star, p.notes, p.pdf_path,
               p.url, p.language, p.volume, p.issue, p.pages,
               p.replication_available, p.code_available
        FROM v_paper_full vf
        JOIN papers p ON p.paper_id = vf.paper_id
        WHERE vf.paper_id = %s
        """,
        (paper_id,),
    )
    return cur.fetchone()


def get_paper_authors(cur, paper_id):
    cur.execute(
        """
        SELECT a.author_id, a.full_name, a.institution, a.orcid, pa.position
        FROM paper_authors pa
        JOIN authors a ON a.author_id = pa.author_id
        WHERE pa.paper_id = %s
        ORDER BY pa.position
        """,
        (paper_id,),
    )
    return cur.fetchall()


def get_paper_projects(cur, paper_id):
    cur.execute(
        """
        SELECT pr.project_id, pr.name, pp.relevance_note, pp.citation_intent
        FROM paper_projects pp
        JOIN projects pr ON pr.project_id = pp.project_id
        WHERE pp.paper_id = %s
        ORDER BY pr.name
        """,
        (paper_id,),
    )
    return cur.fetchall()


def get_paper_attachments(cur, paper_id):
    # NOTE: returns file_path metadata only — never serves PDF contents.
    cur.execute(
        """
        SELECT attachment_id, filename, mime_type, file_path, md5, created_at
        FROM attachments
        WHERE paper_id = %s
        ORDER BY created_at
        """,
        (paper_id,),
    )
    return cur.fetchall()


def get_paper_annotations(cur, paper_id):
    cur.execute(
        """
        SELECT annotation_id, page_number, highlight_text, user_note,
               color, annotation_type, created_at
        FROM annotations
        WHERE paper_id = %s
        ORDER BY page_number NULLS LAST, created_at
        """,
        (paper_id,),
    )
    return cur.fetchall()


def get_paper_claims(cur, paper_id):
    cur.execute(
        """
        SELECT *
        FROM claims
        WHERE paper_id = %s
        ORDER BY page_number NULLS LAST, created_at
        """,
        (paper_id,),
    )
    return cur.fetchall()


def get_paper_concepts(cur, paper_id):
    cur.execute(
        """
        SELECT c.concept_id, c.name, c.definition, pc.role, pc.context_note
        FROM paper_concepts pc
        JOIN concepts c ON c.concept_id = pc.concept_id
        WHERE pc.paper_id = %s
        ORDER BY c.name
        """,
        (paper_id,),
    )
    return cur.fetchall()


def get_paper_methods(cur, paper_id):
    cur.execute(
        """
        SELECT m.method_id, m.name, m.paradigm, m.tradition, m.category,
               pm.context_note
        FROM paper_methods pm
        JOIN methods m ON m.method_id = pm.method_id
        WHERE pm.paper_id = %s
        ORDER BY m.name
        """,
        (paper_id,),
    )
    return cur.fetchall()


def get_paper_variables(cur, paper_id):
    cur.execute(
        """
        SELECT v.variable_id, v.name, v.category, v.definition, v.unit, pv.role
        FROM paper_variables pv
        JOIN variables v ON v.variable_id = pv.variable_id
        WHERE pv.paper_id = %s
        ORDER BY v.name
        """,
        (paper_id,),
    )
    return cur.fetchall()


def paper_exists(cur, paper_id):
    cur.execute("SELECT 1 FROM papers WHERE paper_id = %s", (paper_id,))
    return cur.fetchone() is not None


# Editable scalar columns allowed on the update endpoint.
EDITABLE_PAPER_FIELDS = {"is_read", "star", "status", "notes"}


def update_paper(cur, paper_id, fields: dict):
    """Update allowed scalar fields. Returns the updated row, or None."""
    sets, params = [], []
    for key, val in fields.items():
        if key in EDITABLE_PAPER_FIELDS:
            sets.append(f"{key} = %s")
            params.append(val)
    if not sets:
        # Nothing to update — just return current row.
        cur.execute("SELECT * FROM papers WHERE paper_id = %s", (paper_id,))
        return cur.fetchone()
    sets.append("updated_at = NOW()")
    params.append(paper_id)
    cur.execute(
        f"UPDATE papers SET {', '.join(sets)} WHERE paper_id = %s RETURNING *",
        params,
    )
    return cur.fetchone()


def replace_paper_projects(cur, paper_id, project_ids: list):
    """Idempotently replace the set of project links for a paper."""
    cur.execute("DELETE FROM paper_projects WHERE paper_id = %s", (paper_id,))
    for pid in project_ids:
        cur.execute(
            """
            INSERT INTO paper_projects (paper_id, project_id)
            VALUES (%s, %s)
            ON CONFLICT (paper_id, project_id) DO NOTHING
            """,
            (paper_id, pid),
        )
