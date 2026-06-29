"""Idea endpoints."""
from flask import Blueprint, request

from db import get_db_connection
from api import (require_auth, error_response, ok, get_pagination,
                 paginated, log_change)

bp = Blueprint("ideas", __name__)


@bp.get("/api/ideas")
def list_ideas():
    page, per_page, offset = get_pagination()
    project_id = request.args.get("project_id")
    status = request.args.get("status")
    where, params = [], []
    if project_id:
        where.append("i.project_id = %s")
        params.append(project_id)
    if status:
        where.append("i.status = %s")
        params.append(status)
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    try:
        with get_db_connection() as conn, conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM ideas i {where_sql}", params)
            total = cur.fetchone()["c"]
            cur.execute(
                f"""
                SELECT i.idea_id, i.project_id, i.title, i.description,
                       i.status, i.created_at, i.updated_at, pr.name AS project_name
                FROM ideas i
                LEFT JOIN projects pr ON pr.project_id = i.project_id
                {where_sql}
                ORDER BY i.updated_at DESC
                LIMIT %s OFFSET %s
                """,
                params + [per_page, offset],
            )
            rows = cur.fetchall()
        return ok(paginated(rows, total, page, per_page))
    except Exception as exc:  # noqa: BLE001
        return error_response("Failed to list ideas.", 500, str(exc))


@bp.post("/api/idea")
@require_auth
def create_idea():
    body = request.get_json(silent=True) or {}
    title = (body.get("title") or "").strip()
    if not title:
        return error_response("'title' is required.", 422)
    try:
        with get_db_connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO ideas (project_id, title, description, status)
                VALUES (%s, %s, %s, %s)
                RETURNING *
                """,
                (
                    body.get("project_id"),
                    title,
                    body.get("description"),
                    body.get("status", "raw"),
                ),
            )
            idea = cur.fetchone()
            log_change(cur, "ideas", idea["idea_id"], "INSERT", {"title": title})
            conn.commit()
        return ok(idea, 201)
    except Exception as exc:  # noqa: BLE001
        return error_response("Failed to create idea.", 500, str(exc))
