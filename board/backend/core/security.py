"""Optional API-token protection.

The dashboard API is designed to run on the loopback interface for a single
user, so authentication is **off by default** and no token is needed for local
use. When the API is bound to a non-loopback address (or through a tunnel),
enable it with::

    API_AUTH_ENABLED=true
    API_TOKEN=<random string>

and give the frontend the same value as ``VITE_API_TOKEN``.

Only state-changing requests are checked; reads stay open so the dashboard can
load without extra round-trips.
"""

import hmac

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
TOKEN_HEADER = "X-API-Token"


class RequireApiTokenMiddleware(BaseHTTPMiddleware):
    """Reject state-changing requests that do not carry the configured token."""

    def __init__(self, app, token: str):
        super().__init__(app)
        self._token = token

    async def dispatch(self, request: Request, call_next):
        if request.method not in SAFE_METHODS:
            provided = request.headers.get(TOKEN_HEADER, "")
            if not hmac.compare_digest(provided, self._token):
                return JSONResponse(
                    {"detail": "Invalid or missing API token"},
                    status_code=401,
                )
        return await call_next(request)
