"""Unified FDE Learning OS API — production modular monolith entry."""

from __future__ import annotations

import sys
import time
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest

_PKG_ROOT = Path(__file__).resolve().parents[2]
if str(_PKG_ROOT) not in sys.path:
    sys.path.insert(0, str(_PKG_ROOT))
from services.shared.config import ROOT as _ROOT  # noqa: E402

from services.shared import ARTIFACT_ROOT, FDE_ENV, ensure_dirs, init_schema, setup_logging  # noqa: E402
from services.shared.config import CORS_ORIGINS  # noqa: E402
from services.shared.middleware import RequestContextMiddleware  # noqa: E402

# Explicit, static router composition — no dynamic file scanning.
# Each service module exposes both a standalone `app` (for `uvicorn ...:app`)
# and a `router` that this modular-monolith entry mounts. The two hyphenated
# dirs (`coach-gateway`, `sim-router`) are re-exported via proper packages
# (`services.coach_gateway`, `services.sim_router`).
from services.auth.app import router as auth_router  # noqa: E402
from services.kb_kernel.app import router as kb_router  # noqa: E402
from services.agent_gateway.app import router as agent_router  # noqa: E402
from services.orchestrator.app import router as orchestrator_router  # noqa: E402
from services.coach_gateway.app import router as coach_router  # noqa: E402
from services.progress.app import router as progress_router  # noqa: E402
from services.sim_router.app import router as sim_router  # noqa: E402
from services.eval_bridge.app import router as eval_router  # noqa: E402
from services.author.app import router as author_router  # noqa: E402
from services.media.app import router as media_router  # noqa: E402
from services.learner.app import router as learner_router  # noqa: E402
from services.sql_lab.app import router as sql_lab_router  # noqa: E402
from services.billing.app import router as billing_router  # noqa: E402
from services.partner.app import router as partner_router  # noqa: E402
from services.chain.app import router as chain_router  # noqa: E402
from services.wechat_mp.app import router as wechat_mp_router  # noqa: E402

setup_logging()
ensure_dirs()
init_schema()

REQS = Counter("fde_http_requests_total", "HTTP requests", ["method", "path", "status"])
LATENCY = Histogram("fde_http_request_duration_seconds", "Latency", ["method", "path"])

# (router, service title) — order defines route precedence for shared paths
# such as `/health`; auth wins, matching prior dedup behavior.
_ROUTERS = [
    (auth_router, "FDE Auth"),
    (kb_router, "FDE KbKernel"),
    (agent_router, "FDE AgentGateway"),
    (orchestrator_router, "FDE Orchestrator"),
    (coach_router, "FDE Coach Gateway"),
    (progress_router, "FDE Progress"),
    (sim_router, "FDE Sim Router"),
    (eval_router, "FDE EvalBridge"),
    (author_router, "FDE Author"),
    (media_router, "FDE Media"),
    (learner_router, "FDE Learner"),
    (sql_lab_router, "FDE SQL Lab"),
    (billing_router, "FDE Billing"),
    (partner_router, "FDE Partner"),
    (chain_router, "FDE Chain"),
    (wechat_mp_router, "FDE WeChat MP"),
]
_SERVICE_TITLES = [title for _, title in _ROUTERS]

app = FastAPI(
    title="FDE Learning OS",
    version="0.4.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token", "X-Request-Id", "Last-Event-ID"],
)
app.add_middleware(RequestContextMiddleware)


@app.middleware("http")
async def metrics_mw(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    path = request.url.path
    label_path = path if path.count("/") <= 4 else path.rsplit("/", 1)[0]
    REQS.labels(request.method, label_path, str(response.status_code)).inc()
    LATENCY.labels(request.method, label_path).observe(time.perf_counter() - start)
    return response


_web_dist = _ROOT / "web" / "dist"
_web_index = _web_dist / "index.html"


@app.get("/")
def root() -> Response:
    """Public landing (M2): serve the React SPA at `/` so `Landing.tsx` can
    render — it fetches its own content from `/api/v1/site/landing` and is
    not gated by auth. Falls back to redirecting into `/app/` only when no
    SPA build is mounted (pure API / prototype-only deployments)."""
    if _web_index.exists():
        return FileResponse(_web_index)
    return RedirectResponse(url="/app/", status_code=302)


@app.get("/api")
@app.get("/api/")
def api_index() -> dict:
    return {
        "name": "FDE Learning OS API",
        "version": "0.4.0",
        "docs": "/api/docs",
        "openapi": "/api/openapi.json",
        "redoc": "/api/redoc",
        "v1": "/api/v1",
        "healthz": "/healthz",
        "app": "/app/",
        "author": "/author/",
    }


for _router, _title in _ROUTERS:
    app.include_router(_router)


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok", "version": "0.4.0", "services": _SERVICE_TITLES}


@app.get("/livez")
def livez() -> dict:
    return {"status": "ok"}


@app.get("/readyz")
def readyz() -> Response:
    from fastapi.responses import JSONResponse

    from services.shared.config import DATABASE_URL, S3_ENDPOINT
    from services.shared.db import healthcheck
    from services.storage import get_store

    checks: dict[str, str] = {}
    ok = True
    try:
        if not DATABASE_URL or not DATABASE_URL.startswith("postgres"):
            raise RuntimeError("DATABASE_URL missing")
        hc = healthcheck()
        if not hc.get("ok"):
            raise RuntimeError(hc.get("error") or "pg unhealthy")
        checks["postgres"] = "ok"
    except Exception as exc:
        ok = False
        checks["postgres"] = f"fail:{exc}"
    try:
        get_store().ensure_buckets()
        checks["minio"] = "ok"
    except Exception as exc:
        ok = False
        checks["minio"] = f"fail:{exc}"
    checks["lingzhi"] = "degraded_or_unchecked"
    try:
        from services.shared.anycode_client import anycode_healthy

        checks["anycode"] = "ok" if anycode_healthy() else "degraded"
    except Exception as exc:
        checks["anycode"] = f"degraded:{exc}"
    # Queue depth is informational only — a deep backlog does not flip
    # readiness (the API itself is fine; it's the worker fleet that's behind)
    # but operators/alerting should see it in the readyz body.
    try:
        import os

        from services.shared.db import db_cursor as _db_cursor

        with _db_cursor() as cur:
            cur.execute("SELECT COUNT(*) AS c FROM jobs WHERE status IN ('queued','hydrating')")
            row = cur.fetchone()
        queue_depth = int(row["c"]) if row else 0
        warn_threshold = int(os.getenv("FDE_QUEUE_DEPTH_WARN", "100"))
        checks["queue_depth"] = queue_depth
        if queue_depth >= warn_threshold:
            checks["queue_depth_warning"] = (
                f"queue depth {queue_depth} >= warn threshold {warn_threshold} — worker fleet may be under-provisioned"
            )
    except Exception as exc:
        checks["queue_depth"] = f"unknown:{exc}"
    body = {"status": "ok" if ok else "not_ready", "checks": checks, "s3_endpoint": S3_ENDPOINT}
    return JSONResponse(body, status_code=200 if ok else 503)


@app.get("/metrics")
def metrics() -> Response:
    # No auth here by design (Prometheus scrape contract) — Helm MUST NOT
    # expose this path on the public Ingress; scrape it in-cluster only
    # (see deploy/helm/fde-platform/values.yaml + networkpolicy.yaml comments,
    # and docs/ops/production-gate.md).
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


# Prefer React build; fall back to prototype
_proto_app = _ROOT / "prototype" / "app"
_proto_author = _ROOT / "prototype" / "author"

if _web_dist.is_dir() and (_web_dist / "index.html").exists():
    assets = _web_dist / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets)), name="web_assets")
    landing = _web_dist / "landing"
    if landing.is_dir():
        app.mount("/landing", StaticFiles(directory=str(landing)), name="web_landing")
    brand = _web_dist / "brand"
    if brand.is_dir():
        app.mount("/brand", StaticFiles(directory=str(brand)), name="web_brand")

    @app.get("/app")
    @app.get("/app/")
    @app.get("/app/{full_path:path}")
    async def spa_app(full_path: str = ""):
        return FileResponse(_web_dist / "index.html")

    @app.get("/author")
    @app.get("/author/")
    @app.get("/author/{full_path:path}")
    async def spa_author(full_path: str = ""):
        return FileResponse(_web_dist / "index.html")

    @app.get("/open")
    async def spa_open():
        return FileResponse(_web_dist / "index.html")

    @app.get("/about")
    async def spa_about():
        return FileResponse(_web_dist / "index.html")

    @app.get("/docs/{full_path:path}")
    async def spa_docs(full_path: str = ""):
        return FileResponse(_web_dist / "index.html")

    @app.get("/login")
    async def spa_login():
        return FileResponse(_web_dist / "index.html")

    @app.get("/verify")
    async def spa_verify_form():
        return FileResponse(_web_dist / "index.html")

    @app.get("/verify/{cert_id}")
    async def spa_verify(cert_id: str):
        return FileResponse(_web_dist / "index.html")

    @app.get("/chain")
    async def spa_chain():
        return FileResponse(_web_dist / "index.html")

    @app.get("/chain/algorithms")
    async def spa_chain_algorithms():
        return FileResponse(_web_dist / "index.html")

    @app.get("/chain/block/{height}")
    async def spa_chain_block(height: int):
        return FileResponse(_web_dist / "index.html")

    @app.get("/chain/tx/{tx_hash}")
    async def spa_chain_tx(tx_hash: str):
        return FileResponse(_web_dist / "index.html")

    @app.get("/chain/cert/{cert_id}")
    async def spa_chain_cert(cert_id: str):
        return FileResponse(_web_dist / "index.html")
else:
    if _proto_app.is_dir():
        app.mount("/app", StaticFiles(directory=str(_proto_app), html=True), name="proto_app")
    if _proto_author.is_dir():
        app.mount("/author", StaticFiles(directory=str(_proto_author), html=True), name="proto_author")

_slice = _ROOT / "prototype" / "slice"
if _slice.is_dir():
    app.mount("/slice", StaticFiles(directory=str(_slice), html=True), name="slice")

# Public /artifacts only in non-prod for local debug
if FDE_ENV != "prod" and ARTIFACT_ROOT.is_dir():
    app.mount("/artifacts", StaticFiles(directory=str(ARTIFACT_ROOT)), name="artifacts")

# Course content assets (class/): diagrams, open-course docs, schedule site,
# homework/template downloads. Mounted in all envs — it IS course content.
_course_assets = _ROOT / "class"
if _course_assets.is_dir():
    app.mount("/course-assets", StaticFiles(directory=str(_course_assets), html=True), name="course_assets")
