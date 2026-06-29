"""Statistics and global search endpoints."""
from flask import Blueprint, request

from db import get_db_connection
from api import error_response, ok
from queries import stats_queries as q

bp = Blueprint("stats", __name__)


@bp.get("/api/stats")
def stats():
    project_id = request.args.get("project_id")
    try:
        with get_db_connection() as conn, conn.cursor() as cur:
            data = q.library_stats(cur, project_id=project_id)
        return ok(data)
    except Exception as exc:  # noqa: BLE001
        return error_response("Failed to compute stats.", 500, str(exc))


@bp.get("/api/search")
def search():
    query = (request.args.get("q") or request.args.get("query") or "").strip()
    if not query:
        return error_response("Query parameter 'q' is required.", 422)
    try:
        limit = min(int(request.args.get("limit", 10)), 50)
    except (TypeError, ValueError):
        limit = 10
    try:
        with get_db_connection() as conn, conn.cursor() as cur:
            results = q.global_search(cur, query, limit=limit)
        return ok({"query": query, "results": results})
    except Exception as exc:  # noqa: BLE001
        return error_response("Search failed.", 500, str(exc))
