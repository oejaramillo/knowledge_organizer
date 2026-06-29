"""Shared API utilities: auth decorator, pagination, error helpers, change log."""
import json
import functools
from typing import Any

from flask import jsonify, request

from config import Config


# --------------------------------------------------------------------------- #
# Error / response helpers
# --------------------------------------------------------------------------- #
def error_response(message: str, status: int = 400, details: Any = None):
    """Return a standardized JSON error response."""
    return jsonify({"error": message, "details": details}), status


def ok(payload: Any, status: int = 200):
    return jsonify(payload), status


# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #
def _extract_token() -> str | None:
    """Read the bearer token from Authorization header or X-API-Token."""
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    token = request.headers.get("X-API-Token")
    if token:
        return token.strip()
    return None


def require_auth(fn):
    """Decorator enforcing a valid API token on write endpoints."""

    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        expected = Config.API_TOKEN
        if not expected:
            return error_response(
                "Server misconfigured: API_TOKEN is not set.", 500
            )
        provided = _extract_token()
        if not provided:
            return error_response(
                "Missing API token. Send 'Authorization: Bearer <token>'.", 401
            )
        if provided != expected:
            return error_response("Invalid API token.", 403)
        return fn(*args, **kwargs)

    return wrapper


# --------------------------------------------------------------------------- #
# Pagination
# --------------------------------------------------------------------------- #
def get_pagination() -> tuple[int, int, int]:
    """Parse ?page & ?per_page query params. Returns (page, per_page, offset)."""
    try:
        page = int(request.args.get("page", 1))
    except (TypeError, ValueError):
        page = 1
    try:
        per_page = int(request.args.get("per_page", Config.DEFAULT_PER_PAGE))
    except (TypeError, ValueError):
        per_page = Config.DEFAULT_PER_PAGE

    page = max(page, 1)
    per_page = max(1, min(per_page, Config.MAX_PER_PAGE))
    offset = (page - 1) * per_page
    return page, per_page, offset


def paginated(items: list, total: int, page: int, per_page: int) -> dict:
    """Wrap a list of items in a pagination envelope."""
    pages = (total + per_page - 1) // per_page if per_page else 0
    return {
        "data": items,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": pages,
            "has_next": page < pages,
            "has_prev": page > 1,
        },
    }


# --------------------------------------------------------------------------- #
# Change log
# --------------------------------------------------------------------------- #
def log_change(cur, table_name: str, record_id: str, action: str,
               changed_fields: dict | None = None,
               contributor_id: str | None = None) -> None:
    """Insert an audit row into change_log. Uses an existing cursor so it
    participates in the caller's transaction."""
    contributor_id = contributor_id or Config.DEFAULT_CONTRIBUTOR_ID
    cur.execute(
        """
        INSERT INTO change_log
            (table_name, record_id, action, contributor_id, changed_fields)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (
            table_name,
            record_id,
            action,
            contributor_id,
            json.dumps(changed_fields or {}, default=str),
        ),
    )
