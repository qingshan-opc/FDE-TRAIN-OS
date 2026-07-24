"""KbKernel — production LingZhi client with retries + camp tags on memories."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from typing import Any, Iterator

import httpx
from fastapi import APIRouter, FastAPI, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from services.shared import LINGZHI_BASE_URL, camp_api_key, log  # noqa: E402
from services.shared.middleware import require_camp_access, require_user, session_camp_id  # noqa: E402

router = APIRouter(tags=["kb"])
app = FastAPI(title="FDE KbKernel", version="0.3.0")


class AskBody(BaseModel):
    question: str
    camp_id: str | None = None
    session_id: str | None = None
    limit: int = 8
    fallback: bool = True
    fallback_steps: list[str] = Field(default_factory=list)
    day_tags: list[str] = Field(default_factory=list)


class MemoryBody(BaseModel):
    content: str
    title: str | None = None
    tags: list[str] = Field(default_factory=list)
    camp_id: str | None = None
    session_id: str | None = None


def _headers(camp_id: str | None) -> dict[str, str]:
    key = camp_api_key(camp_id)
    h = {"Content-Type": "application/json"}
    if key:
        h["X-API-Key"] = key
    return h


def _offline(question: str, steps: list[str], error: str | None = None) -> dict[str, Any]:
    body = "\n".join(f"- {s}" for s in steps) if steps else "（未配置灵知 Key 或服务不可达）"
    out = {
        "mode": "offline",
        "answer": f"【离线 KbKernel】关于「{question}」\n\n{body}",
        "citations": [],
        "question": question,
    }
    if error:
        out["error"] = error
        out["error_code"] = "LINGZHI_UNAVAILABLE"
    return out


def _request(method: str, path: str, camp_id: str | None, **kwargs) -> httpx.Response:
    url = f"{LINGZHI_BASE_URL}{path}"
    last: Exception | None = None
    for attempt in range(3):
        try:
            with httpx.Client(timeout=httpx.Timeout(30.0, connect=5.0)) as client:
                r = client.request(method, url, headers=_headers(camp_id), **kwargs)
                if r.status_code >= 500:
                    raise httpx.HTTPStatusError("server error", request=r.request, response=r)
                return r
        except Exception as exc:
            last = exc
            time.sleep(0.4 * (attempt + 1))
            log.warning("lingzhi retry %s %s: %s", attempt, path, exc)
    raise RuntimeError(str(last))


@router.get("/health")
def health() -> dict[str, Any]:
    live = False
    try:
        with httpx.Client(timeout=2.0) as client:
            live = client.get(f"{LINGZHI_BASE_URL}/health").status_code < 500
    except Exception:
        live = False
    return {
        "status": "ok",
        "service": "kb-kernel",
        "lingzhi_base": LINGZHI_BASE_URL,
        "has_api_key": bool(camp_api_key(None)),
        "lingzhi_up": live,
    }


@router.get("/api/v1/kb/knowledge")
def list_knowledge(
    request: Request,
    q: str | None = None,
    tag: str | None = None,
    limit: int = Query(20, ge=1, le=50),
    camp_id: str | None = None,
) -> dict[str, Any]:
    require_user(request)
    camp = session_camp_id(request, camp_id)
    if not camp_api_key(camp):
        return {"items": [], "mode": "offline", "tag": tag, "q": q}
    params: dict[str, Any] = {"limit": limit}
    if q:
        params["q"] = q
    if tag:
        params["tag"] = tag
    try:
        r = _request("GET", "/api/v2/open/knowledge", camp, params=params)
        if r.status_code == 401:
            return {"items": [], "mode": "offline", "error_code": "UNAUTHORIZED", "error": r.text}
        r.raise_for_status()
        data = r.json()
        data["mode"] = "live"
        return data
    except Exception as exc:
        return {"items": [], "mode": "offline", "error": str(exc), "error_code": "LINGZHI_UNAVAILABLE"}


@router.post("/api/v1/kb/ask")
def ask(body: AskBody, request: Request) -> dict[str, Any]:
    require_user(request)
    camp = session_camp_id(request, body.camp_id)
    if not camp_api_key(camp):
        return _offline(body.question, body.fallback_steps)
    q = body.question
    if body.day_tags:
        q = f"[tags:{','.join(body.day_tags)}] {q}"
    try:
        r = _request(
            "POST",
            "/api/v2/open/rag/ask",
            camp,
            json={"question": q, "limit": body.limit, "session_id": body.session_id, "fallback": body.fallback},
        )
        if r.status_code >= 400:
            return _offline(body.question, body.fallback_steps, error=r.text)
        data = r.json()
        if isinstance(data, dict):
            data["mode"] = "live"
            # normalize citations
            if "citations" not in data:
                data["citations"] = data.get("sources") or data.get("refs") or []
            return data
        return {"raw": data, "mode": "live", "citations": []}
    except Exception as exc:
        return _offline(body.question, body.fallback_steps, error=str(exc))


@router.post("/api/v1/kb/ask/stream")
def ask_stream(body: AskBody, request: Request) -> StreamingResponse:
    require_user(request)
    camp = session_camp_id(request, body.camp_id)
    if not camp_api_key(camp):
        offline = _offline(body.question, body.fallback_steps)

        def gen_off() -> Iterator[str]:
            yield f"data: {json.dumps(offline, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(gen_off(), media_type="text/event-stream")

    def gen() -> Iterator[str]:
        try:
            with httpx.Client(timeout=120.0) as client:
                with client.stream(
                    "POST",
                    f"{LINGZHI_BASE_URL}/api/v2/open/rag/ask/stream",
                    json={
                        "question": body.question,
                        "limit": body.limit,
                        "session_id": body.session_id,
                        "fallback": body.fallback,
                    },
                    headers=_headers(camp),
                ) as r:
                    r.raise_for_status()
                    for line in r.iter_lines():
                        if line is not None:
                            yield line + "\n"
        except Exception as exc:
            offline = _offline(body.question, body.fallback_steps, error=str(exc))
            yield f"data: {json.dumps(offline, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")


@router.post("/api/v1/kb/memories")
def upload_memory(body: MemoryBody, request: Request) -> dict[str, Any]:
    # login + camp access required: author/admin may write into any camp,
    # a learner may only write memories into their own (session-resolved) camp.
    require_user(request)
    camp = session_camp_id(request, body.camp_id)
    require_camp_access(request, camp)
    if not camp_api_key(camp):
        raise HTTPException(503, detail={"error_code": "NO_API_KEY", "message": "LINGZHI_API_KEY not configured"})
    tags = list(body.tags or [])
    if f"camp:{camp}" not in tags:
        tags.append(f"camp:{camp}")
    if "fde-memory" not in tags:
        tags.append("fde-memory")
    try:
        r = _request(
            "POST",
            "/api/v2/open/memories",
            camp,
            json={"title": body.title, "content": body.content, "tags": tags, "session_id": body.session_id},
        )
        if r.status_code >= 400:
            raise HTTPException(r.status_code, r.text)
        data = r.json()
        if isinstance(data, dict):
            data["mode"] = "live"
            data["tags"] = tags
        return data if isinstance(data, dict) else {"raw": data, "mode": "live"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, detail={"error_code": "LINGZHI_UNAVAILABLE", "message": str(exc)}) from exc


app.include_router(router)
