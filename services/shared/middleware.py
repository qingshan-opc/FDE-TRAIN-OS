"""FastAPI auth + CSRF + security headers middleware."""

from __future__ import annotations

import contextvars
import uuid
from typing import Callable

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from services.shared import ALLOW_DEV_HEADERS, AuthUser, FDE_ENV, decode_access_token, get_user_by_id, user_enrolled
from services.shared.config import CORS_ORIGINS

# Populated per-request by RequestContextMiddleware; read by the logging
# record factory (services.shared.setup_logging) so every log line carries
# the request_id without every call site having to pass it explicitly.
request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("fde_request_id", default="-")

# Docs/Redoc load Swagger UI / Redoc bundles from a CDN — relax CSP only for
# those paths so `/api/docs` keeps working; every other response gets the
# strict default below.
_CSP_DOCS = (
    "default-src 'self'; "
    "img-src 'self' data: https:; "
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "connect-src 'self' https:; "
    "font-src 'self' data: https://cdn.jsdelivr.net"
)
_CSP_DEFAULT = (
    "default-src 'self'; "
    "img-src 'self' data: blob:; "
    "media-src 'self' blob:; "
    "connect-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline'; "
    "frame-ancestors 'none'"
)
_DOCS_PREFIXES = ("/api/docs", "/api/redoc")

PUBLIC_EXACT = {
    "/",
    "/api",
    "/api/",
    "/healthz",
    "/metrics",
    "/livez",
    "/readyz",
    "/api/docs",
    "/api/redoc",
    "/api/openapi.json",
}
PUBLIC_PREFIXES = (
    "/health",
    "/api/docs",
    "/api/redoc",
    "/api/v1/auth/login",
    "/api/v1/auth/invite",
    "/api/v1/auth/logout",
    "/api/v1/auth/refresh",
    "/app",
    "/author",
    "/login",
    "/assets",
    "/slice",
)

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
CSRF_HEADER = "X-CSRF-Token"
CSRF_COOKIE = "fde_csrf"
ACCESS_COOKIE = "fde_token"


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        rid = request.headers.get("X-Request-Id") or str(uuid.uuid4())
        request.state.request_id = rid
        request.state.user = None
        request.state.camp_id = None
        token_ctx = request_id_var.set(rid)

        token = None
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:].strip()
        if not token:
            token = request.cookies.get(ACCESS_COOKIE)

        if not token and ALLOW_DEV_HEADERS and FDE_ENV != "prod" and request.headers.get("X-Learner-Id"):
            request.state.user = AuthUser(
                id=request.headers["X-Learner-Id"],
                email=f"{request.headers['X-Learner-Id']}@local",
                role="learner",
            )
            request.state.camp_id = request.headers.get("X-Camp-Id", "camp-v03")
        elif token:
            try:
                payload = decode_access_token(token)
                user = get_user_by_id(payload["sub"])
                if user:
                    request.state.user = user
                    request.state.camp_id = payload.get("camp_id")
            except Exception:
                request.state.user = None

        # CSRF double-submit only when authenticated via cookie (not pure Bearer)
        if (
            request.method not in SAFE_METHODS
            and request.cookies.get(ACCESS_COOKIE)
            and request.url.path.startswith("/api/")
            and request.url.path
            not in (
                "/api/v1/auth/login",
                "/api/v1/auth/invite",
                "/api/v1/auth/logout",
                "/api/v1/auth/refresh",
            )
        ):
            cookie_csrf = request.cookies.get(CSRF_COOKIE)
            header_csrf = request.headers.get(CSRF_HEADER)
            if not cookie_csrf or not header_csrf or cookie_csrf != header_csrf:
                return Response(
                    '{"detail":"CSRF validation failed"}',
                    status_code=403,
                    media_type="application/json",
                )

        try:
            response = await call_next(request)
        finally:
            request_id_var.reset(token_ctx)
        response.headers["X-Request-Id"] = rid
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        is_docs = request.url.path.startswith(_DOCS_PREFIXES)
        response.headers.setdefault("Content-Security-Policy", _CSP_DOCS if is_docs else _CSP_DEFAULT)
        if FDE_ENV == "prod":
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response


def require_user(request: Request) -> AuthUser:
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(401, "未登录")
    return user


def require_author(request: Request) -> AuthUser:
    user = require_user(request)
    if user.role not in ("author", "admin"):
        raise HTTPException(403, "需要教研权限")
    return user


def require_camp_access(request: Request, camp_id: str) -> AuthUser:
    user = require_user(request)
    if user.role in ("author", "admin"):
        return user
    if not user_enrolled(user.id, camp_id):
        raise HTTPException(403, "无权访问该营期")
    return user


def session_learner_id(request: Request) -> str:
    """Always derive learner_id from session — never trust body/query."""
    user = require_user(request)
    return user.id


def session_camp_id(request: Request, fallback: str | None = None) -> str:
    camp = getattr(request.state, "camp_id", None) or fallback
    if not camp:
        raise HTTPException(400, "未选择营期")
    return camp


def resolve_camp_id(request: Request, body_camp_id: str | None = None) -> str:
    """Session camp (verified at login) wins; falling back to a client-supplied
    camp_id requires a fresh enrollment check so callers cannot spoof camp scope."""
    camp = getattr(request.state, "camp_id", None)
    if camp:
        return camp
    if not body_camp_id:
        raise HTTPException(400, "未选择营期")
    require_camp_access(request, body_camp_id)
    return body_camp_id


def optional_user(request: Request) -> AuthUser | None:
    return getattr(request.state, "user", None)


def cors_origins() -> list[str]:
    return CORS_ORIGINS
