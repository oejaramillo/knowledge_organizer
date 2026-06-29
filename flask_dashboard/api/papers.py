"""Paper endpoints."""
from flask import Blueprint, request

from db import get_db_connection
from api import (require_auth, error_response, ok, get_pagination,
                 paginated, log_change)
from queries import papers_queries as q

bp = Blueprint("papers", __name__)


def _parse_bool(val):
    if val is None:
        return None
    if isinstance(val, bool):
        return val
    return str(val).lower() in ("1", "true", "yes", "on")


@bp.get("/api/papers")
def list_papers():
    page, per_page, offset = get_pagination()
    args = request.args
    try:
        with get_db_connection() as conn, conn.cursor() as cur:
            rows, total = q.list_papers(
                cur,
                project_id=args.get("project_id"),
                author_id=args.get("author_id"),
                method_id=args.get("method_id"),
                concept_id=args.get("concept_id"),
                is_read=_parse_bool(args.get("is_read")),
                star=_parse_bool(args.get("star")),
                status=args.get("status"),
                search=args.get("q") or args.get("search"),
                limit=per_page, offset=offset,
            )
        return ok(paginated(rows, total, page, per_page))
    except Exception as exc:  # noqa: BLE001
        return error_response("Failed to list papers.", 500, str(exc))


@bp.get("/api/paper/<paper_id>")
def get_paper(paper_id):
    try:
        with get_db_connection() as conn, conn.cursor() as cur:
            core = q.get_paper_core(cur, paper_id)
            if not core:
                return error_response("Paper not found.", 404)
            core["authors_list"] = q.get_paper_authors(cur, paper_id)
            core["project_links"] = q.get_paper_projects(cur, paper_id)
            core["attachments"] = q.get_paper_attachments(cur, paper_id)
            core["annotations"] = q.get_paper_annotations(cur, paper_id)
            core["claims"] = q.get_paper_claims(cur, paper_id)
            core["concept_links"] = q.get_paper_concepts(cur, paper_id)
            core["method_links"] = q.get_paper_methods(cur, paper_id)
            core["variable_links"] = q.get_paper_variables(cur, paper_id)
        return ok(core)
    except Exception as exc:  # noqa: BLE001
        return error_response("Failed to fetch paper.", 500, str(exc))


@bp.post("/api/paper/<paper_id>")
@require_auth
def update_paper(paper_id):
    body = request.get_json(silent=True) or {}
    fields = {}
    if "is_read" in body:
        fields["is_read"] = _parse_bool(body["is_read"])
    if "star" in body:
        fields["star"] = _parse_bool(body["star"])
    if "status" in body:
        fields["status"] = body["status"]
    if "notes" in body:
        fields["notes"] = body["notes"]
    project_ids = body.get("project_ids")

    try:
        with get_db_connection() as conn, conn.cursor() as cur:
            if not q.paper_exists(cur, paper_id):
                return error_response("Paper not found.", 404)
            updated = q.update_paper(cur, paper_id, fields)
            changed = dict(fields)
            if project_ids is not None:
                if not isinstance(project_ids, list):
                    return error_response("'project_ids' must be a list.", 422)
                q.replace_paper_projects(cur, paper_id, project_ids)
                changed["project_ids"] = project_ids
            if changed:
                log_change(cur, "papers", paper_id, "UPDATE", changed)
            conn.commit()
        return ok(updated)
    except Exception as exc:  # noqa: BLE001
        return error_response("Failed to update paper.", 500, str(exc))


@bp.post("/api/paper/<paper_id>/re_enrich")
@require_auth
def re_enrich(paper_id):
    """Placeholder: in production this would enqueue an AI enrichment job
    (re-run extractor/enrich/writer over the paper's annotations)."""
    try:
        with get_db_connection() as conn, conn.cursor() as cur:
            if not q.paper_exists(cur, paper_id):
                return error_response("Paper not found.", 404)
            log_change(cur, "papers", paper_id, "UPDATE",
                       {"action": "re_enrich_requested"})
            conn.commit()
        return ok({
            "paper_id": paper_id,
            "status": "queued",
            "message": "Re-enrichment request accepted (placeholder).",
        }, 202)
    except Exception as exc:  # noqa: BLE001
        return error_response("Failed to queue re-enrichment.", 500, str(exc))
