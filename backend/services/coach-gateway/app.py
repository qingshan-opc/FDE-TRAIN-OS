"""Coach gateway — KbKernel (RAG) + anyCode fde-coach Skill + evidence.

M5 learning loop: every ask/stream/diagnose/handoff call is built from a
course/enrollment/node/attempt-scoped context (``services.application.
coach_context``) — knowledge citations are limited to the current
course_version/day's authorized tags, never a global/unscoped memory pool.
"""

from __future__ import annotations

import hashlib
import json
import logging
import sys
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, FastAPI, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

_PKG_ROOT = Path(__file__).resolve().parents[2]
if str(_PKG_ROOT) not in sys.path:
    sys.path.insert(0, str(_PKG_ROOT))
from services.shared.config import ROOT as _ROOT  # noqa: E402

from services.application.coach_context import (  # noqa: E402
    PROMPT_VERSION,
    build_coach_context,
    build_diagnosis,
)
from services.shared import FDE_INTERNAL_BASE, db_cursor, now_iso, write_audit  # noqa: E402
from services.shared.anycode_client import (  # noqa: E402
    anycode_base,
    anycode_healthy,
    coach_sandbox_path,
    run_turn,
)
from services.shared.config import ANYCODE_COACH_SKILL_ID  # noqa: E402
from services.shared.middleware import resolve_camp_id, session_learner_id  # noqa: E402
from services.shared.rate_limit import rate_limit  # noqa: E402

HelpMode = Literal["explain", "debug", "process", "interview", "review"]
router = APIRouter(tags=["coach"])
app = FastAPI(title="FDE Coach Gateway", version="0.5.0")

SKILL_PATH = _ROOT / "skills" / "fde-coach" / "SKILL.md"
log = logging.getLogger("fde.coach")


class CoachAskRequest(BaseModel):
    help_mode: HelpMode = "explain"
    question: str
    camp_id: str | None = None
    session_id: str | None = None
    node_id: str | None = None
    day_tags: list[str] = Field(default_factory=list)
    fail_count: int = 0
    sim_summary: str | None = None
    agent_job_id: str | None = None
    fallback_steps: list[str] = Field(default_factory=list)
    # accepted for backward-compat client payloads — always overwritten from session
    learner_id: str | None = None
    day: int = 1
    skill_id: str | None = None
    max_help_level: int | None = None


class CoachAskResponse(BaseModel):
    reply: str
    citations: list[dict[str, Any]] = Field(default_factory=list)
    level: int
    coach_mode: Literal["full", "rag_only", "offline"]
    evidence_refs: list[str] = Field(default_factory=list)
    kb_mode: str | None = None
    diagnostics: dict[str, Any] = Field(default_factory=dict)


def _level(fail_count: int, max_help_level: int | None = None) -> int:
    if fail_count <= 1:
        level = 1
    elif fail_count <= 3:
        level = 2
    else:
        level = 3
    if max_help_level is not None and max_help_level > 0:
        level = min(level, max_help_level)
    return level


def _hint(level: int) -> str:
    return {
        1: "LEVEL1：列出检查项，不给完整代码。",
        2: "LEVEL2：可给局部片段与关键步骤。",
        3: "LEVEL3：可给接近完整方案，并要求复述原因。",
    }[level]


def _skill_rules() -> str:
    if SKILL_PATH.exists():
        return SKILL_PATH.read_text(encoding="utf-8")[:6000]
    return "遵循 FDE Coach LEVEL1–3；禁止 Docker/K8s 真命令；知识对错以 citations 为准。"


def _context_brief(ctx: dict[str, Any]) -> str:
    """Chinese, prompt-ready digest of the scoped context (rubric failures,
    quiz failures, latest eval/job/sim) — this is what makes the coach's
    advice course/node/attempt-scoped instead of generic."""
    lines: list[str] = []
    node = ctx.get("node") or {}
    rubric = node.get("rubric") or []
    if rubric:
        failed = [r for r in rubric if isinstance(r, dict) and r.get("suggestion")]
        if failed:
            lines.append("当前节点 Rubric 未通过项：")
            for r in failed[:6]:
                lines.append(f"  - {r.get('title_zh') or r.get('check')}：{r.get('suggestion')}")
        else:
            lines.append(f"当前节点 Rubric 共 {len(rubric)} 项，暂无失败记录。")
    quiz_failures = ctx.get("quiz_failures") or []
    if quiz_failures:
        lines.append(f"最近 {len(quiz_failures)} 次测验未达通过线。")
    latest_eval = ctx.get("latest_eval")
    if isinstance(latest_eval, dict) and latest_eval:
        lines.append(f"最新提交评测：pass={latest_eval.get('pass')} score={latest_eval.get('score')}")
    job = ctx.get("latest_job_summary")
    if job:
        lines.append(f"最新 Agent 任务：status={job.get('status')} job_id={job.get('job_id')}")
    sim = ctx.get("sim_summary")
    if sim:
        lines.append(f"最新仿真会话：sim_kind={sim.get('sim_kind')} session_id={sim.get('session_id')}")
    fail_count = ctx.get("fail_count")
    if fail_count:
        lines.append(f"该节点/当日累计失败次数：{fail_count}")
    return "\n".join(lines) if lines else "（暂无历史失败记录）"


def _kb_ask(req: CoachAskRequest, day_tags: list[str]) -> tuple[str, str, list[dict[str, Any]], str]:
    citations: list[dict[str, Any]] = []
    kb_answer, kb_mode, job_summary = "", "skipped", ""
    base = FDE_INTERNAL_BASE
    try:
        with httpx.Client(timeout=30.0) as client:
            kr = client.post(
                f"{base}/api/v1/kb/ask",
                json={
                    "question": req.question,
                    "camp_id": req.camp_id,
                    "session_id": req.session_id,
                    # course-authorized tags only — never the client's own
                    # (potentially cross-course/day) day_tags, see coach_context.
                    "day_tags": day_tags,
                    "fallback_steps": req.fallback_steps,
                },
            )
            if kr.status_code < 400:
                data = kr.json()
                kb_mode = str(data.get("mode") or "live")
                kb_answer = str(data.get("answer") or "")
                citations = [c for c in (data.get("citations") or []) if isinstance(c, dict)]
            if req.agent_job_id:
                jr = client.get(f"{base}/api/v1/agent/jobs/{req.agent_job_id}/summary")
                if jr.status_code < 400:
                    job_summary = str(jr.json())
    except Exception as exc:
        kb_mode = "error"
        kb_answer = f"（KbKernel 不可达：{exc}）"
    return kb_answer, kb_mode, citations, job_summary


def _compose_prompt(
    req: CoachAskRequest, level: int, kb_answer: str, citations: list[dict], job_summary: str, context_brief: str
) -> str:
    cite_lines = "\n".join(
        f"- {c.get('title') or c.get('id') or c}" for c in citations[:8]
    ) or "（无）"
    return (
        f"{_skill_rules()}\n\n"
        f"## 本次辅导\n"
        f"- help_mode: {req.help_mode}\n"
        f"- LEVEL: {level} — {_hint(level)}\n"
        f"- Day: {req.day}\n"
        f"- 学员问题: {req.question}\n\n"
        f"## 学员当前上下文（course/node/attempt 范围内）\n{context_brief}\n\n"
        f"## 灵知知识面（对错以此为准，仅限本课程当日授权范围）\n{kb_answer or '（无）'}\n\n"
        f"## Citations\n{cite_lines}\n\n"
        f"## 仿真摘要\n{req.sim_summary or '（无）'}\n\n"
        f"## Agent 任务摘要\n{job_summary or '（无）'}\n\n"
        f"请按 SKILL 输出格式给出辅导（判断 / LEVEL 提示 / 建议下一步 / 引用）。"
        f"禁止建议在学员机器或云端启动 Docker/K8s。"
    )


def _local_fallback_reply(
    req: CoachAskRequest,
    level: int,
    kb_answer: str,
    kb_mode: str,
    citations: list[dict],
    job_summary: str,
    context_brief: str,
) -> str:
    reply = (
        f"【{req.help_mode} / LEVEL{level}】\n{_hint(level)}\n\n"
        f"你的情况：\n{context_brief}\n\n"
        f"知识面（{kb_mode}）：\n{kb_answer or '（无）'}\n\n"
        f"仿真：{req.sim_summary or '（无）'}\nAgent：{job_summary or '（无）'}\n"
    )
    if citations:
        reply += "\n引用：\n" + "\n".join(f"- {c.get('title') or c.get('id') or c}" for c in citations[:5])
    return reply


def _write_evidence(req: CoachAskRequest, level: int, digest: str) -> None:
    """Write evidence in-process (same table/shape as services.progress.app.write_evidence)
    instead of an unauthenticated HTTP hop — learner_id always comes from the caller's session."""
    if not req.learner_id:
        return
    try:
        with db_cursor() as cur:
            cur.execute(
                """
                INSERT INTO evidence (id, ts, learner_id, camp_version, day, node_id, kind, payload_json, capability_tags)
                VALUES (?,?,?,?,?,?,?,?,?)
                """,
                (
                    str(uuid4()),
                    now_iso(),
                    req.learner_id,
                    "v0.3",
                    req.day,
                    f"coach-{digest}",
                    "coach",
                    json.dumps(
                        {"level": level, "mode": req.help_mode, "question": req.question, "digest": digest},
                        ensure_ascii=False,
                    ),
                    json.dumps([f"coach:level{level}"], ensure_ascii=False),
                ),
            )
    except Exception as exc:
        log.warning("coach evidence write failed: %s", exc)


def _write_coach_turn(
    req: CoachAskRequest,
    ctx: dict[str, Any],
    answer: str,
    citations: list[dict[str, Any]],
    model: str,
) -> str | None:
    """Persist one coach turn — the audit trail behind the `diagnostics.
    reproducible` contract (model/prompt_version/citation_ids) and the FK
    target for a later `/api/v1/coach/handoff`."""
    if not req.learner_id:
        return None
    turn_id = str(uuid4())
    job_id = req.agent_job_id or (ctx.get("latest_job_summary") or {}).get("job_id")
    try:
        with db_cursor() as cur:
            cur.execute(
                """
                INSERT INTO coach_turns
                  (id, enrollment_id, learner_id, camp_id, day, node_id, question, answer,
                   citations_json, model, prompt_version, eval_version, job_id, submission_id, created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    turn_id,
                    ctx.get("enrollment_id"),
                    req.learner_id,
                    req.camp_id,
                    req.day,
                    req.node_id,
                    req.question,
                    answer,
                    json.dumps(citations, ensure_ascii=False),
                    model,
                    PROMPT_VERSION,
                    ctx.get("eval_version") or "rubric-registry-v1",
                    job_id,
                    ctx.get("latest_submission_id"),
                    now_iso(),
                ),
            )
    except Exception as exc:
        log.warning("coach_turns write failed: %s", exc)
        return None
    return turn_id


def _anycode_coach(
    req: CoachAskRequest,
    level: int,
    kb_answer: str,
    citations: list[dict],
    job_summary: str,
    context_brief: str,
    *,
    on_delta: Any | None = None,
) -> tuple[str | None, str | None, str]:
    """Returns (reply, error, skill). reply None means anyCode unavailable/failed."""
    skill = (req.skill_id or ANYCODE_COACH_SKILL_ID or "fde-coach").strip()
    if not anycode_base() or not anycode_healthy():
        return None, "anyCode Workbench unreachable", skill
    prompt = _compose_prompt(req, level, kb_answer, citations, job_summary, context_brief)
    sandbox = coach_sandbox_path()

    def on_event(ev_name: str, payload: dict[str, Any]) -> None:
        if on_delta and payload.get("kind") == "assistant_delta" and payload.get("text"):
            on_delta(str(payload["text"]))

    try:
        result = run_turn(
            root_path=sandbox,
            project_name="fde-coach",
            prompt=prompt,
            skills=[skill] if skill else None,
            on_event=on_event,
        )
    except Exception as exc:
        return None, str(exc), skill
    if result.get("status") == "session_error":
        return None, str(result.get("error") or "session_error"), skill
    reply = (result.get("reply") or "").strip()
    if not reply:
        return None, f"empty reply (status={result.get('status')})", skill
    return reply, None, skill


def _build_context(req: CoachAskRequest) -> dict[str, Any]:
    return build_coach_context(
        camp_id=req.camp_id,
        learner_id=req.learner_id or "",
        day=req.day,
        node_id=req.node_id,
    )


def _diagnostics_payload(ctx: dict[str, Any], model: str, citations: list[dict[str, Any]]) -> dict[str, Any]:
    diag = build_diagnosis(ctx)
    citation_ids = [c.get("id") for c in citations if isinstance(c, dict) and c.get("id")]
    diag["reproducible"] = {
        "model": model,
        "prompt_version": PROMPT_VERSION,
        "citation_ids": citation_ids,
    }
    return diag


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "coach-gateway"}


@router.post("/api/v1/coach/ask", response_model=CoachAskResponse, dependencies=[Depends(rate_limit("coach_ask"))])
def ask(req: CoachAskRequest, request: Request) -> CoachAskResponse:
    req.learner_id = session_learner_id(request)
    req.camp_id = resolve_camp_id(request, req.camp_id)
    ctx = _build_context(req)
    effective_fail_count = ctx.get("fail_count") or req.fail_count
    level = _level(effective_fail_count, req.max_help_level)
    day_tags = ctx.get("day_tags") or req.day_tags
    if not req.sim_summary and ctx.get("sim_summary"):
        req.sim_summary = json.dumps(ctx["sim_summary"], ensure_ascii=False)
    if not req.agent_job_id and ctx.get("latest_job_summary"):
        req.agent_job_id = ctx["latest_job_summary"].get("job_id")
    kb_answer, kb_mode, citations, job_summary = _kb_ask(req, day_tags)
    context_brief = _context_brief(ctx)
    digest = hashlib.sha256(f"{req.learner_id}:{req.question}:{level}".encode()).hexdigest()[:12]

    reply, err, skill = _anycode_coach(req, level, kb_answer, citations, job_summary, context_brief)
    if reply:
        coach_mode: Literal["full", "rag_only", "offline"] = "full"
        model = f"anycode:{skill}"
    else:
        reply = _local_fallback_reply(req, level, kb_answer, kb_mode, citations, job_summary, context_brief)
        if err:
            reply = f"{reply}\n\n（anyCode 降级：{err}）"
        coach_mode = "offline" if kb_mode in ("offline", "skipped", "error") else "rag_only"
        model = f"fallback:{kb_mode}"

    _write_evidence(req, level, digest)
    _write_coach_turn(req, ctx, reply, citations, model)
    diagnostics = _diagnostics_payload(ctx, model, citations)
    return CoachAskResponse(
        reply=reply,
        citations=citations,
        level=level,
        coach_mode=coach_mode,
        evidence_refs=[f"level:{level}", f"kb:{kb_mode}", f"digest:{digest}", f"coach:{coach_mode}"],
        kb_mode=kb_mode,
        diagnostics=diagnostics,
    )


@router.post("/api/v1/coach/ask/stream", dependencies=[Depends(rate_limit("coach_ask"))])
def ask_stream(req: CoachAskRequest, request: Request) -> StreamingResponse:
    import threading
    from queue import Empty, Queue

    req.learner_id = session_learner_id(request)
    req.camp_id = resolve_camp_id(request, req.camp_id)
    ctx = _build_context(req)
    effective_fail_count = ctx.get("fail_count") or req.fail_count
    level = _level(effective_fail_count, req.max_help_level)
    day_tags = ctx.get("day_tags") or req.day_tags
    if not req.agent_job_id and ctx.get("latest_job_summary"):
        req.agent_job_id = ctx["latest_job_summary"].get("job_id")
    kb_answer, kb_mode, citations, job_summary = _kb_ask(req, day_tags)
    context_brief = _context_brief(ctx)
    digest = hashlib.sha256(f"{req.learner_id}:{req.question}:{level}".encode()).hexdigest()[:12]

    def gen():
        meta = {
            "level": level,
            "kb_mode": kb_mode,
            "citations": citations[:5],
            "digest": digest,
        }
        yield f"event: meta\ndata: {json.dumps(meta, ensure_ascii=False)}\n\n"

        q: Queue[tuple[str, Any]] = Queue()
        box: dict[str, Any] = {}

        def on_delta(text: str) -> None:
            q.put(("delta", text))

        def worker() -> None:
            reply, err, skill = _anycode_coach(
                req, level, kb_answer, citations, job_summary, context_brief, on_delta=on_delta
            )
            box["reply"] = reply
            box["err"] = err
            box["skill"] = skill
            q.put(("end", None))

        t = threading.Thread(target=worker, daemon=True)
        t.start()
        streamed = False
        while True:
            try:
                kind, payload = q.get(timeout=1.0)
            except Empty:
                if not t.is_alive():
                    break
                continue
            if kind == "delta":
                streamed = True
                yield f"event: delta\ndata: {json.dumps({'text': payload}, ensure_ascii=False)}\n\n"
            elif kind == "end":
                break
        t.join(timeout=2.0)

        reply = box.get("reply")
        err = box.get("err")
        if reply:
            if not streamed:
                yield f"event: delta\ndata: {json.dumps({'text': reply}, ensure_ascii=False)}\n\n"
            coach_mode = "full"
            final = reply
            model = f"anycode:{box.get('skill')}"
        else:
            final = _local_fallback_reply(req, level, kb_answer, kb_mode, citations, job_summary, context_brief)
            if err:
                final = f"{final}\n\n（anyCode 降级：{err}）"
            coach_mode = "offline" if kb_mode in ("offline", "skipped", "error") else "rag_only"
            model = f"fallback:{kb_mode}"
            yield f"event: delta\ndata: {json.dumps({'text': final}, ensure_ascii=False)}\n\n"

        _write_evidence(req, level, digest)
        _write_coach_turn(req, ctx, final, citations, model)
        diagnostics = _diagnostics_payload(ctx, model, citations)
        done = {
            "reply": final,
            "level": level,
            "coach_mode": coach_mode,
            "kb_mode": kb_mode,
            "citations": citations,
            "diagnostics": diagnostics,
        }
        yield f"event: done\ndata: {json.dumps(done, ensure_ascii=False)}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")


class CoachDiagnoseRequest(BaseModel):
    camp_id: str | None = None
    day: int = 1
    node_id: str | None = None
    # accepted for backward-compat client payloads — always ignored, session wins
    learner_id: str | None = None


class CoachDiagnoseResponse(BaseModel):
    mode: Literal["offline"]
    diagnosis_zh: str
    error_tags: list[str] = Field(default_factory=list)
    next_action: str
    next_action_zh: str
    next_node_hint: str | None = None
    fail_count: int = 0


@router.post("/api/v1/coach/diagnose", response_model=CoachDiagnoseResponse)
def diagnose(req: CoachDiagnoseRequest, request: Request) -> CoachDiagnoseResponse:
    """Deterministic (LLM-free) learning diagnosis from the latest failed
    eval/quiz — always works, even with anyCode/lingzhi both unreachable."""
    learner_id = session_learner_id(request)
    camp_id = resolve_camp_id(request, req.camp_id)
    ctx = build_coach_context(camp_id=camp_id, learner_id=learner_id, day=req.day, node_id=req.node_id)
    diag = build_diagnosis(ctx)
    return CoachDiagnoseResponse(
        mode="offline",
        diagnosis_zh=diag["diagnosis_zh"],
        error_tags=diag["error_tags"],
        next_action=diag["next_action"],
        next_action_zh=diag["next_action_zh"],
        next_node_hint=diag.get("next_node_hint"),
        fail_count=diag.get("fail_count", 0),
    )


class CoachHandoffRequest(BaseModel):
    camp_id: str | None = None
    day: int = 1
    node_id: str | None = None
    question: str = ""
    coach_turn_id: str | None = None
    # accepted for backward-compat client payloads — always ignored, session wins
    learner_id: str | None = None


class CoachHandoffResponse(BaseModel):
    ok: bool = True
    review_id: str
    status: str = "pending"
    diagnostics: dict[str, Any] = Field(default_factory=dict)


@router.post("/api/v1/coach/handoff", response_model=CoachHandoffResponse)
def handoff(req: CoachHandoffRequest, request: Request) -> CoachHandoffResponse:
    """申请导师复核 — create a `mentor_reviews` row an author can pick up via
    `GET /api/v1/author/reviews`, carrying the same deterministic diagnosis
    the learner already saw so a mentor doesn't start from zero."""
    learner_id = session_learner_id(request)
    camp_id = resolve_camp_id(request, req.camp_id)
    ctx = build_coach_context(camp_id=camp_id, learner_id=learner_id, day=req.day, node_id=req.node_id)
    diagnostics = build_diagnosis(ctx)
    review_id = str(uuid4())
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO mentor_reviews
              (id, learner_id, camp_id, enrollment_id, day, node_id, submission_id, coach_turn_id,
               reason, diagnostics_json, status, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,'pending',NOW())
            """,
            (
                review_id,
                learner_id,
                camp_id,
                ctx.get("enrollment_id"),
                req.day,
                req.node_id,
                ctx.get("latest_submission_id"),
                req.coach_turn_id,
                req.question or "",
                json.dumps(diagnostics, ensure_ascii=False),
            ),
        )
    write_audit("coach.handoff", actor_id=learner_id, camp_id=camp_id, resource_type="mentor_review", resource_id=review_id)
    return CoachHandoffResponse(ok=True, review_id=review_id, status="pending", diagnostics=diagnostics)


@router.get("/api/v1/coach/mentor-reviews")
def list_learner_mentor_reviews(
    request: Request,
    day: int,
    node_id: str | None = None,
    camp_id: str | None = None,
    limit: int = 5,
) -> dict[str, Any]:
    """Learner-facing mentor review status for the active day/node."""
    if day < 1:
        raise HTTPException(400, "day must be >= 1")
    learner_id = session_learner_id(request)
    camp = resolve_camp_id(request, camp_id)
    lim = min(max(limit, 1), 20)
    with db_cursor() as cur:
        if node_id:
            cur.execute(
                """
                SELECT id, day, node_id, reason, status, mentor_feedback, mentor_score, created_at, resolved_at
                FROM mentor_reviews
                WHERE learner_id=? AND camp_id=? AND day=? AND node_id=?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (learner_id, camp, day, node_id, lim),
            )
        else:
            cur.execute(
                """
                SELECT id, day, node_id, reason, status, mentor_feedback, mentor_score, created_at, resolved_at
                FROM mentor_reviews
                WHERE learner_id=? AND camp_id=? AND day=?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (learner_id, camp, day, lim),
            )
        items = []
        for row in cur.fetchall():
            d = dict(row)
            for k in ("created_at", "resolved_at"):
                if d.get(k) and hasattr(d[k], "isoformat"):
                    d[k] = d[k].isoformat()
            items.append(d)
    return {"items": items}


app.include_router(router)
