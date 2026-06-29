"""Project-related SQL queries (parameterized)."""


def list_projects(cur, *, search=None, status=None, limit=25, offset=0):
    """Return (rows, total) for projects with optional search + status filter.

    Progress stats come from the v_project_progress view (joined by name)."""
    where = []
    params = []

    if search:
        where.append("(p.name ILIKE %s OR p.description ILIKE %s)")
        like = f"%{search}%"
        params.extend([like, like])
    if status:
        where.append("p.status = %s")
        params.append(status)

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""

    # total count
    cur.execute(f"SELECT COUNT(*) AS c FROM projects p {where_sql}", params)
    total = cur.fetchone()["c"]

    cur.execute(
        f"""
        SELECT
            p.project_id,
            p.name,
            p.parent_project,
            p.description,
            p.status,
            p.keywords,
            p.created_at,
            p.updated_at,
            COALESCE(prog.total_papers, 0)  AS total_papers,
            COALESCE(prog.processed, 0)     AS processed,
            COALESCE(prog.read, 0)          AS read,
            COALESCE(prog.unread, 0)        AS unread,
            COALESCE(prog.total_claims, 0)  AS total_claims,
            COALESCE(prog.total_annotations, 0) AS total_annotations
        FROM projects p
        LEFT JOIN v_project_progress prog ON prog.project = p.name
        {where_sql}
        ORDER BY p.name
        LIMIT %s OFFSET %s
        """,
        params + [limit, offset],
    )
    return cur.fetchall(), total


def get_project(cur, project_id):
    cur.execute(
        """
        SELECT
            p.*,
            COALESCE(prog.total_papers, 0)  AS total_papers,
            COALESCE(prog.processed, 0)     AS processed,
            COALESCE(prog.read, 0)          AS read,
            COALESCE(prog.unread, 0)        AS unread,
            COALESCE(prog.total_claims, 0)  AS total_claims,
            COALESCE(prog.total_annotations, 0) AS total_annotations
        FROM projects p
        LEFT JOIN v_project_progress prog ON prog.project = p.name
        WHERE p.project_id = %s
        """,
        (project_id,),
    )
    return cur.fetchone()


def get_project_papers(cur, project_id, limit=200, offset=0):
    cur.execute(
        """
        SELECT
            p.paper_id, p.title, p.year, p.journal, p.status,
            p.is_read, p.star, p.document_type
        FROM papers p
        JOIN paper_projects pp ON pp.paper_id = p.paper_id
        WHERE pp.project_id = %s
        ORDER BY p.year DESC NULLS LAST, p.title
        LIMIT %s OFFSET %s
        """,
        (project_id, limit, offset),
    )
    return cur.fetchall()


def create_project(cur, *, name, description=None, parent_project=None,
                   status="active", keywords=None):
    cur.execute(
        """
        INSERT INTO projects (name, description, parent_project, status, keywords)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING *
        """,
        (name, description, parent_project, status, keywords),
    )
    return cur.fetchone()


def find_project_by_name(cur, name):
    """Used to keep project creation idempotent on (name)."""
    cur.execute("SELECT * FROM projects WHERE name = %s LIMIT 1", (name,))
    return cur.fetchone()
