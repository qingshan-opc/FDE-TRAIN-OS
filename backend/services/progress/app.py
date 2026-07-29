"""Progress, passport, capsule progress, submissions."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, FastAPI, HTTPException, Request
from pydantic import BaseModel, Field

_PKG_ROOT = Path(__file__).resolve().parents[2]
if str(_PKG_ROOT) not in sys.path:
    sys.path.insert(0, str(_PKG_ROOT))
from services.shared.config import ROOT as _ROOT  # noqa: E402

from services.shared import db_cursor, init_schema, now_iso, write_audit  # noqa: E402
from services.shared.middleware import require_user, session_camp_id, session_learner_id  # noqa: E402

router = APIRouter(tags=["progress"])
app = FastAPI(title="FDE Progress", version="0.4.0")
init_schema()


class EvidenceIn(BaseModel):
    camp_version: str = "v0.3"
    day: int
    node_id: str
    kind: str
    payload: dict[str, Any] = Field(default_factory=dict)
    capability_tags: list[str] = Field(default_factory=list)
    # ignored — session wins
    learner_id: str | None = None


class CapsuleProgressIn(BaseModel):
    camp_id: str | None = None
    day: int
    capsule_id: str
    learner_id: str | None = None


class PracticeIn(BaseModel):
    camp_id: str | None = None
    day: int
    capsule_id: str
    response_text: str = ""
    response_json: dict[str, Any] = Field(default_factory=dict)
    status: str = "draft"  # draft|submitted
    # Explicit reopen after submit. Without this flag, a racing draft autosave
    # must not downgrade an already-submitted practice back to draft.
    force_reopen: bool = False
    # ignored — session wins
    learner_id: str | None = None


class SubmissionIn(BaseModel):
    camp_id: str | None = None
    day: int
    node_id: str
    job_id: str | None = None
    snapshot_id: str | None = None
    eval: dict[str, Any] = Field(default_factory=dict)


class FeedbackIn(BaseModel):
    feedback: str
    score: float | None = None


class LearningHeartbeatIn(BaseModel):
    camp_id: str | None = None
    day: int = Field(ge=1)
    delta_seconds: int = Field(ge=1, le=300)


DEFAULT_WEEKS: dict[str, list[int]] = {
    "1": [1, 2, 3, 4, 5],
    "2": [6, 7, 8, 9, 10, 11, 12],
}


def _week_for_day(day: int, weeks: dict[str, list[int]] | None = None) -> int:
    mapping = weeks or DEFAULT_WEEKS
    for key, days in mapping.items():
        if day in days:
            try:
                return int(key)
            except ValueError:
                continue
    return max(1, (day - 1) // 5 + 1)


def _day_progress_counts(learner_id: str, camp_id: str, day: int) -> tuple[int, int]:
    """Return (passed, total) for a training day — unique nodes, excluding unlock."""
    from services.db import session_scope
    from services.repositories import ProgressRepository

    with session_scope() as session:
        return ProgressRepository(session).day_passed_total(learner_id, camp_id, day)


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "progress"}


@router.post("/api/v1/evidence")
def write_evidence(body: EvidenceIn, request: Request) -> dict[str, Any]:
    learner_id = session_learner_id(request)
    eid = str(uuid4())
    ts = now_iso()
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO evidence (id, ts, learner_id, camp_version, day, node_id, kind, payload_json, capability_tags)
            VALUES (?,?,?,?,?,?,?,?,?)
            """,
            (
                eid,
                ts,
                learner_id,
                body.camp_version,
                body.day,
                body.node_id,
                body.kind,
                json.dumps(body.payload, ensure_ascii=False),
                json.dumps(body.capability_tags, ensure_ascii=False),
            ),
        )
    return {"id": eid, "ts": ts, "learner_id": learner_id, **body.model_dump(exclude={"learner_id"})}


@router.post("/api/v1/capsules/progress")
def capsule_progress(body: CapsuleProgressIn, request: Request) -> dict[str, Any]:
    learner_id = session_learner_id(request)
    camp_id = session_camp_id(request, body.camp_id)
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO capsule_progress (learner_id, camp_id, day, capsule_id, opened_at)
            VALUES (?,?,?,?,NOW())
            ON CONFLICT (learner_id, camp_id, day, capsule_id) DO NOTHING
            """,
            (learner_id, camp_id, body.day, body.capsule_id),
        )
        cur.execute(
            "SELECT COUNT(*) AS c FROM capsule_progress WHERE learner_id=? AND camp_id=? AND day=?",
            (learner_id, camp_id, body.day),
        )
        count = int(cur.fetchone()["c"])
    write_audit("capsule.open", actor_id=learner_id, camp_id=camp_id, resource_id=body.capsule_id)
    return {"ok": True, "learner_id": learner_id, "camp_id": camp_id, "day": body.day, "opened_count": count}


@router.get("/api/v1/capsules/progress")
def list_capsule_progress(request: Request, day: int | None = None, camp_id: str | None = None) -> dict[str, Any]:
    learner_id = session_learner_id(request)
    camp = session_camp_id(request, camp_id)
    with db_cursor() as cur:
        if day is not None:
            cur.execute(
                "SELECT day, capsule_id, opened_at FROM capsule_progress WHERE learner_id=? AND camp_id=? AND day=?",
                (learner_id, camp, day),
            )
        else:
            cur.execute(
                "SELECT day, capsule_id, opened_at FROM capsule_progress WHERE learner_id=? AND camp_id=? ORDER BY day, opened_at",
                (learner_id, camp),
            )
        items = [dict(r) for r in cur.fetchall()]
    return {"items": items, "learner_id": learner_id, "camp_id": camp}


@router.get("/api/v1/practice")
def list_practice(request: Request, day: int | None = None, camp_id: str | None = None) -> dict[str, Any]:
    """List this learner's practice responses (draft + submitted), scoped to camp/day."""
    learner_id = session_learner_id(request)
    camp = session_camp_id(request, camp_id)
    with db_cursor() as cur:
        if day is not None:
            cur.execute(
                """
                SELECT id, day, capsule_id, response_text, response_json, status, submitted_at, updated_at
                FROM practice_responses WHERE learner_id=? AND camp_id=? AND day=?
                ORDER BY updated_at
                """,
                (learner_id, camp, day),
            )
        else:
            cur.execute(
                """
                SELECT id, day, capsule_id, response_text, response_json, status, submitted_at, updated_at
                FROM practice_responses WHERE learner_id=? AND camp_id=?
                ORDER BY day, updated_at
                """,
                (learner_id, camp),
            )
        items = []
        for r in cur.fetchall():
            d = dict(r)
            rj = d.get("response_json")
            d["response_json"] = rj if isinstance(rj, dict) else (json.loads(rj) if rj else {})
            if d.get("submitted_at") is not None and hasattr(d["submitted_at"], "isoformat"):
                d["submitted_at"] = d["submitted_at"].isoformat()
            if d.get("updated_at") is not None and hasattr(d["updated_at"], "isoformat"):
                d["updated_at"] = d["updated_at"].isoformat()
            items.append(d)
    return {"items": items, "learner_id": learner_id, "camp_id": camp}


@router.put("/api/v1/practice")
def save_practice(body: PracticeIn, request: Request) -> dict[str, Any]:
    """Upsert a draft/submitted practice response for one capsule.

    Idempotent per (learner, camp, day, capsule) — repeated autosave calls
    just overwrite the same row; ``submitted_at`` is only stamped the first
    time status flips to ``submitted`` and is otherwise preserved.
    """
    learner_id = session_learner_id(request)
    camp_id = session_camp_id(request, body.camp_id)
    status = body.status if body.status in ("draft", "submitted") else "draft"
    force_reopen = bool(body.force_reopen)
    pid = str(uuid4())
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO practice_responses
              (id, learner_id, camp_id, day, capsule_id, response_text, response_json, status, submitted_at, updated_at)
            VALUES (?,?,?,?,?,?,?::jsonb,?, CASE WHEN ?='submitted' THEN NOW() ELSE NULL END, NOW())
            ON CONFLICT (learner_id, camp_id, day, capsule_id) DO UPDATE
              SET response_text=EXCLUDED.response_text,
                  response_json=EXCLUDED.response_json,
                  status=CASE
                    WHEN EXCLUDED.status='submitted' THEN 'submitted'
                    WHEN practice_responses.status='submitted' AND ? = false THEN 'submitted'
                    ELSE EXCLUDED.status
                  END,
                  submitted_at=CASE
                    WHEN EXCLUDED.status='submitted' AND practice_responses.submitted_at IS NULL THEN NOW()
                    ELSE practice_responses.submitted_at
                  END,
                  updated_at=NOW()
            RETURNING id, status, submitted_at, updated_at
            """,
            (
                pid,
                learner_id,
                camp_id,
                body.day,
                body.capsule_id,
                body.response_text,
                json.dumps(body.response_json, ensure_ascii=False),
                status,
                status,
                force_reopen,
            ),
        )
        row = cur.fetchone()
        pid = row["id"] if row else pid
        status = row["status"] if row else status
        submitted_at = row.get("submitted_at") if row else None
    write_audit("practice.save", actor_id=learner_id, camp_id=camp_id, resource_id=body.capsule_id)
    return {
        "id": pid,
        "learner_id": learner_id,
        "camp_id": camp_id,
        "day": body.day,
        "capsule_id": body.capsule_id,
        "response_text": body.response_text,
        "status": status,
        "submitted_at": submitted_at.isoformat() if submitted_at and hasattr(submitted_at, "isoformat") else submitted_at,
    }


@router.get("/api/v1/learning/daily-summary")
def learning_daily_summary(request: Request, day: int, camp_id: str | None = None) -> dict[str, Any]:
    """Study time + day progress for the learner workbench top bar."""
    if day < 1:
        raise HTTPException(400, "day must be >= 1")
    learner_id = session_learner_id(request)
    camp = session_camp_id(request, camp_id)
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT study_seconds, updated_at FROM learning_daily_stats
            WHERE learner_id=? AND camp_id=? AND day=?
            """,
            (learner_id, camp, day),
        )
        row = cur.fetchone()
        study_seconds = int(row["study_seconds"]) if row else 0
    passed, total = _day_progress_counts(learner_id, camp, day)
    progress_pct = min(100, round(passed * 100 / total)) if total > 0 else 0
    week = _week_for_day(day)
    return {
        "learner_id": learner_id,
        "camp_id": camp,
        "day": day,
        "week": week,
        "passed": passed,
        "total": total,
        "progress_pct": progress_pct,
        "study_seconds": study_seconds,
    }


@router.post("/api/v1/learning/heartbeat")
def learning_heartbeat(body: LearningHeartbeatIn, request: Request) -> dict[str, Any]:
    """Accumulate visible study time for the active training day."""
    if body.day < 1:
        raise HTTPException(400, "day must be >= 1")
    learner_id = session_learner_id(request)
    camp_id = session_camp_id(request, body.camp_id)
    delta = min(max(body.delta_seconds, 1), 300)
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO learning_daily_stats (learner_id, camp_id, day, study_seconds, updated_at)
            VALUES (?,?,?,?,NOW())
            ON CONFLICT (learner_id, camp_id, day) DO UPDATE
              SET study_seconds = learning_daily_stats.study_seconds + EXCLUDED.study_seconds,
                  updated_at = NOW()
            RETURNING study_seconds
            """,
            (learner_id, camp_id, body.day, delta),
        )
        row = cur.fetchone()
        total_seconds = int(row["study_seconds"]) if row else delta
    return {
        "ok": True,
        "learner_id": learner_id,
        "camp_id": camp_id,
        "day": body.day,
        "study_seconds": total_seconds,
        "delta_seconds": delta,
    }


@router.post("/api/v1/submissions")
def create_submission(body: SubmissionIn, request: Request) -> dict[str, Any]:
    learner_id = session_learner_id(request)
    camp_id = session_camp_id(request, body.camp_id)
    sid = str(uuid4())
    with db_cursor() as cur:
        if not body.snapshot_id:
            cur.execute(
                "SELECT snapshot_id FROM workspace_heads WHERE camp_id=? AND learner_id=?",
                (camp_id, learner_id),
            )
            head = cur.fetchone()
            snapshot_id = head["snapshot_id"] if head else None
        else:
            snapshot_id = body.snapshot_id
        cur.execute(
            """
            INSERT INTO submissions (id, camp_id, learner_id, day, node_id, job_id, snapshot_id, eval_json, status, created_at)
            VALUES (?,?,?,?,?,?,?,?::jsonb,'submitted',NOW())
            ON CONFLICT (learner_id, camp_id, day, node_id, job_id) DO UPDATE
            SET eval_json=EXCLUDED.eval_json,
                snapshot_id=EXCLUDED.snapshot_id,
                status='submitted',
                feedback=CASE WHEN submissions.status IN ('failed', 'passed') THEN NULL ELSE submissions.feedback END,
                score=CASE WHEN submissions.status IN ('failed', 'passed') THEN NULL ELSE submissions.score END,
                created_at=NOW()
            RETURNING id
            """,
            (
                sid,
                camp_id,
                learner_id,
                body.day,
                body.node_id,
                body.job_id,
                snapshot_id,
                json.dumps(body.eval, ensure_ascii=False),
            ),
        )
        row = cur.fetchone()
        sid = row["id"] if row else sid
    write_audit("submission.create", actor_id=learner_id, camp_id=camp_id, resource_id=sid)
    return {"id": sid, "snapshot_id": snapshot_id, "status": "submitted"}


@router.get("/api/v1/submissions")
def get_learner_submission(request: Request, day: int, node_id: str, camp_id: str | None = None) -> dict[str, Any]:
    """Latest project submission for the current learner/day/node (includes mentor feedback)."""
    if day < 1:
        raise HTTPException(400, "day must be >= 1")
    learner_id = session_learner_id(request)
    camp = session_camp_id(request, camp_id)
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT id, camp_id, learner_id, day, node_id, job_id, snapshot_id, status, feedback, score,
                   eval_json, created_at
            FROM submissions
            WHERE learner_id=? AND camp_id=? AND day=? AND node_id=?
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (learner_id, camp, day, node_id),
        )
        row = cur.fetchone()
    if not row:
        return {"item": None}
    item = dict(row)
    raw = item.pop("eval_json") or "{}"
    item["eval_json"] = json.loads(raw) if isinstance(raw, str) else raw
    if item.get("created_at") and hasattr(item["created_at"], "isoformat"):
        item["created_at"] = item["created_at"].isoformat()
    return {"item": item}


@router.get("/api/v1/learners/{learner_id}/evidence")
def list_evidence(learner_id: str, request: Request) -> dict[str, Any]:
    user = require_user(request)
    if user.role not in ("author", "admin") and user.id != learner_id:
        raise HTTPException(403, "无权查看")
    with db_cursor() as cur:
        cur.execute("SELECT * FROM evidence WHERE learner_id=? ORDER BY ts DESC", (learner_id,))
        items = []
        for r in cur.fetchall():
            d = dict(r)
            d["payload"] = json.loads(d.pop("payload_json") or "{}")
            d["capability_tags"] = json.loads(d.pop("capability_tags") or "[]")
            items.append(d)
    return {"learner_id": learner_id, "items": items}


@router.get("/api/v1/learners/{learner_id}/passport")
def passport(learner_id: str, request: Request) -> dict[str, Any]:
    user = require_user(request)
    if user.role not in ("author", "admin") and user.id != learner_id:
        raise HTTPException(403, "无权查看")
    with db_cursor() as cur:
        cur.execute("SELECT * FROM evidence WHERE learner_id=?", (learner_id,))
        rows = cur.fetchall()
        cur.execute("SELECT COUNT(*) AS c FROM submissions WHERE learner_id=?", (learner_id,))
        sub_count = int(cur.fetchone()["c"])
    tags: set[str] = set()
    has_agent = False
    has_sim = False
    for e in rows:
        d = dict(e)
        tags.update(json.loads(d.get("capability_tags") or "[]"))
        kind = d.get("kind")
        # "lab" is the legacy kind written before the Agent Lab evidence fix
        # (M7) — an Agent Lab completion, so it belongs on the agent track,
        # not the sim track.
        if kind in ("agent", "lab"):
            has_agent = True
        if kind == "sim":
            has_sim = True
    if has_agent and has_sim:
        prefix = "FDE-DUAL"
    elif has_agent:
        prefix = "FDE-AGENT"
    else:
        prefix = "FDE-SIM"
    cert = f"{prefix}-{learner_id[:8].upper()}-{len(rows):04d}"
    parts = []
    if has_sim:
        parts.append("含平台仿真能力认证")
    if has_agent:
        parts.append("含 Agent 工作区交付认证")
    parts.append("复杂生产技能以答辩补齐")
    return {
        "learner_id": learner_id,
        "cert_id": cert,
        "disclaimer": "；".join(parts),
        "capability_tags": sorted(tags),
        "evidence_count": len(rows),
        "submission_count": sub_count,
        "tracks": {"sim": has_sim, "agent": has_agent},
    }


@router.post("/api/v1/author/submissions/{submission_id}/feedback")
def submission_feedback(submission_id: str, body: FeedbackIn, request: Request) -> dict[str, Any]:
    user = require_user(request)
    if user.role not in ("author", "admin"):
        raise HTTPException(403, "仅教研可反馈")
    with db_cursor() as cur:
        cur.execute(
            "UPDATE submissions SET feedback=?, score=? WHERE id=? RETURNING id",
            (body.feedback, body.score, submission_id),
        )
        if not cur.fetchone():
            raise HTTPException(404, "submission not found")
    write_audit("submission.feedback", actor_id=user.id, resource_id=submission_id)
    return {"ok": True, "id": submission_id}


app.include_router(router)
