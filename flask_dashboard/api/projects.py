"""Project endpoints."""
from flask import Blueprint, request

from db import get_db_connection
from api import (require_auth, error_response, ok, get_pagination,
                 paginated, log_change)
from queries import projects_queries as q

bp = Blueprint("projects", __name__)


@bp.get("/api/projects")
def list_projects():
    page, per_page, offset = get_pagination()
    search = request.args.get("q") or request.args.get("search")
    status = request.args.get("status")
    try:
        with get_db_connection() as conn, conn.cursor() as cur:
            rows, total = q.list_projects(
                cur, search=search, status=status,
                limit=per_page, offset=offset,
            )
        return ok(paginated(rows, total, page, per_page))
    except Exception as exc:  # noqa: BLE001
        return error_response("Failed to list projects.", 500, str(exc))


@bp.get("/api/project/<project_id>")
def get_project(project_id):
    try:
        with get_db_connection() as conn, conn.cursor() as cur:
            project = q.get_project(cur, project_id)
            if not project:
                return error_response("Project not found.", 404)
            papers = q.get_project_papers(cur, project_id)
        project["papers"] = papers
        return ok(project)
    except Exception as exc:  # noqa: BLE001
        return error_response("Failed to fetch project.", 500, str(exc))


@bp.post("/api/project")
@require_auth
def create_project():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        return error_response("'name' is required.", 422)
    try:
        with get_db_connection() as conn, conn.cursor() as cur:
            # Idempotent on name: return existing if present.
            existing = q.find_project_by_name(cur, name)
            if existing:
                return ok(existing, 200)
            project = q.create_project(
                cur,
                name=name,
                description=body.get("description"),
                parent_project=body.get("parent_project"),
                status=body.get("status", "active"),
                keywords=body.get("keywords"),
            )
            log_change(cur, "projects", project["project_id"], "INSERT",
                       {"name": name})
            conn.commit()
        return ok(project, 201)
    except Exception as exc:  # noqa: BLE001
        return error_response("Failed to create project.", 500, str(exc))
