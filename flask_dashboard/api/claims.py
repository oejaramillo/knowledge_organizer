"""Claim endpoints."""
from flask import Blueprint, request

from db import get_db_connection
from api import require_auth, error_response, ok, log_change
from queries import claims_queries as q
from queries import papers_queries as pq

bp = Blueprint("claims", __name__)


@bp.post("/api/claim")
@require_auth
def create_claim():
    body = request.get_json(silent=True) or {}
    paper_id = body.get("paper_id")
    claim_text = (body.get("claim") or "").strip()
    if not paper_id:
        return error_response("'paper_id' is required.", 422)
    if not claim_text:
        return error_response("'claim' text is required.", 422)
    body["claim"] = claim_text
    try:
        with get_db_connection() as conn, conn.cursor() as cur:
            if not pq.paper_exists(cur, paper_id):
                return error_response("Paper not found.", 404)
            claim = q.create_claim(cur, paper_id, body)
            log_change(cur, "claims", claim["claim_id"], "INSERT",
                       {"claim": claim_text, "paper_id": paper_id})
            conn.commit()
        return ok(claim, 201)
    except Exception as exc:  # noqa: BLE001
        return error_response("Failed to create claim.", 500, str(exc))


@bp.patch("/api/claim/<claim_id>")
@require_auth
def update_claim(claim_id):
    body = request.get_json(silent=True) or {}
    try:
        with get_db_connection() as conn, conn.cursor() as cur:
            existing = q.get_claim(cur, claim_id)
            if not existing:
                return error_response("Claim not found.", 404)
            updated = q.update_claim(cur, claim_id, body)
            changed = {k: body[k] for k in body if k in q.CLAIM_FIELDS}
            log_change(cur, "claims", claim_id, "UPDATE", changed)
            conn.commit()
        return ok(updated)
    except Exception as exc:  # noqa: BLE001
        return error_response("Failed to update claim.", 500, str(exc))
