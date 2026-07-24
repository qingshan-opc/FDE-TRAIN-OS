"""Coach context builder (M5) — enrollment/course_version/node/attempt-scoped
context for the AI learning-diagnosis loop.

``build_coach_context`` is the single place that resolves *everything* the AI
coach is allowed to see for one turn: the current node's rubric (enriched,
Chinese), recent quiz failures, the latest lab evaluation, the latest agent
job summary, a sim session summary (if any), the latest submission id, and
the *authorized* knowledge tags for this course_version/day (sourced from the
day package's ``learn.lingzhi_tags`` — never a global/unscoped tag set, so
RAG citations can never leak across courses or camps).

``build_diagnosis`` turns that context into a deterministic, LLM-free
diagnosis (Chinese) — this is what keeps the coach loop useful (offline
degradation) when anyCode/lingzhi are both unavailable: rubric/quiz failures
already carry Chinese explanations via ``rubric_registry``, so a structured
recommendation can always be produced from data already in Postgres.

Dependency-light on purpose: only ``services.shared.db_cursor`` (legacy
tables) and ``services.application.course_runtime`` (domain-v2 course/day
resolution) — no FastAPI, no anyCode/lingzhi clients — so it is safe to unit
test without a running app and to call from any service.
"""

from __future__ import annotations

import json
from typing import Any

from services.application import course_runtime
from services.shared import db_cursor
from services.shared.rubric_registry import enrich_rubric_list

# Bump when the context shape or prompt-injection format changes so a coach
# turn's `prompt_version` stays a reliable "reproducible" marker.
PROMPT_VERSION = "coach-ctx-v1"
# Tracks the rubric/eval enrichment contract (services.shared.rubric_registry)
# used to produce `checks[].suggestion` / `weighted_score` on eval results.
EVAL_VERSION = "rubric-registry-v1"

NEXT_ACTION_ZH = {
    "retry_lab": "重做 Lab",
    "reread_capsule": "重读学习胶囊",
    "ask_mentor": "申请导师复核",
    "continue": "继续当前学习节奏",
}


def _node_kind_from_id(node_id: str | None) -> str | None:
    """``"d3-lab"`` -> ``"lab"`` (see orchestrator's ``f"d{day}-{kind}"`` convention)."""
    if not node_id or "-" not in node_id:
        return None
    return node_id.rsplit("-", 1)[-1]


def resolve_enrollment_id(camp_id: str | None, learner_id: str | None) -> str | None:
    """Best-effort: the learner's newest enrollment in this camp."""
    if not (camp_id and learner_id):
        return None
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT e.id FROM enrollment_records e
            JOIN course_offerings o ON o.id = e.offering_id
            WHERE e.user_id=? AND o.camp_id=?
            ORDER BY e.created_at DESC LIMIT 1
            """,
            (learner_id, camp_id),
        )
        row = cur.fetchone()
        return row["id"] if row else None


def _resolve_camp_id_from_enrollment(enrollment_id: str) -> str | None:
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT o.camp_id AS camp_id FROM enrollment_records e
            JOIN course_offerings o ON o.id = e.offering_id
            WHERE e.id=?
            """,
            (enrollment_id,),
        )
        row = cur.fetchone()
        return row["camp_id"] if row else None


def _latest_quiz_failures(learner_id: str, camp_id: str, day: int, limit: int = 5) -> list[dict[str, Any]]:
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT id, node_id, score, pass, created_at
            FROM quiz_attempts
            WHERE learner_id=? AND camp_id=? AND day=? AND pass=0
            ORDER BY created_at DESC LIMIT ?
            """,
            (learner_id, camp_id, day, limit),
        )
        return [dict(r) for r in cur.fetchall()]


def _recent_fail_count(learner_id: str, camp_id: str, day: int, node_id: str | None) -> int:
    """Real (DB-backed) failure count for this day (+node, when known) — used
    to authoritatively drive the coach's LEVEL1-3 help gate instead of trusting
    a client-supplied ``fail_count`` that resets on every page reload."""
    with db_cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) AS c FROM quiz_attempts WHERE learner_id=? AND camp_id=? AND day=? AND pass=0",
            (learner_id, camp_id, day),
        )
        quiz_fails = int(cur.fetchone()["c"])
        params: list[Any] = [learner_id, camp_id, day]
        node_clause = ""
        if node_id:
            node_clause = " AND node_id=?"
            params.append(node_id)
        cur.execute(
            f"SELECT COUNT(*) AS c FROM submissions WHERE learner_id=? AND camp_id=? AND day=?{node_clause} AND status='failed'",
            params,
        )
        lab_fails = int(cur.fetchone()["c"])
    return quiz_fails + lab_fails


def _latest_submission(learner_id: str, camp_id: str, day: int, node_id: str | None) -> dict[str, Any] | None:
    with db_cursor() as cur:
        if node_id:
            cur.execute(
                """
                SELECT id, node_id, job_id, snapshot_id, eval_json, status, feedback, score, created_at
                FROM submissions WHERE learner_id=? AND camp_id=? AND day=? AND node_id=?
                ORDER BY created_at DESC LIMIT 1
                """,
                (learner_id, camp_id, day, node_id),
            )
        else:
            cur.execute(
                """
                SELECT id, node_id, job_id, snapshot_id, eval_json, status, feedback, score, created_at
                FROM submissions WHERE learner_id=? AND camp_id=? AND day=?
                ORDER BY created_at DESC LIMIT 1
                """,
                (learner_id, camp_id, day),
            )
        row = cur.fetchone()
        if not row:
            return None
        d = dict(row)
        ev = d.get("eval_json")
        d["eval_json"] = json.loads(ev) if isinstance(ev, str) else (ev or {})
        return d


def _latest_job_summary(learner_id: str, camp_id: str) -> dict[str, Any] | None:
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT id, kind, status, payload_json, result_json, created_at
            FROM jobs WHERE learner_id=? AND camp_id=? ORDER BY created_at DESC LIMIT 1
            """,
            (learner_id, camp_id),
        )
        row = cur.fetchone()
        if not row:
            return None
        d = dict(row)
        payload = d.get("payload_json")
        payload = json.loads(payload) if isinstance(payload, str) else (payload or {})
        result = d.get("result_json")
        result = json.loads(result) if isinstance(result, str) else (result or {})
        return {
            "job_id": d["id"],
            "kind": d.get("kind"),
            "status": d.get("status"),
            "node_id": payload.get("node_id"),
            "files": result.get("files") if isinstance(result, dict) else None,
            "snapshot_id": result.get("snapshot_id") if isinstance(result, dict) else None,
            "created_at": d.get("created_at"),
        }


def _latest_sim_summary(learner_id: str, camp_id: str, day: int) -> dict[str, Any] | None:
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT id, sim_kind, state_json, version, updated_at
            FROM sim_sessions WHERE learner_id=? AND camp_id=? AND day=? ORDER BY updated_at DESC LIMIT 1
            """,
            (learner_id, camp_id, day),
        )
        row = cur.fetchone()
        if not row:
            return None
        d = dict(row)
        state = d.get("state_json")
        state = json.loads(state) if isinstance(state, str) else (state or {})
        keys = list(state)[:8] if isinstance(state, dict) else []
        return {
            "session_id": d["id"],
            "sim_kind": d.get("sim_kind"),
            "version": d.get("version"),
            "summary": {k: state[k] for k in keys},
        }


def _node_rubric(
    day_data: dict[str, Any] | None, node_id: str | None
) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    if not day_data or not node_id:
        return None, []
    kind = _node_kind_from_id(node_id)
    title = ""
    for n in day_data.get("nodes") or []:
        if (n.get("type") or n.get("kind")) == kind:
            title = n.get("title") or ""
            break
    rubric: list[dict[str, Any]] = []
    if kind == "lab":
        rubric = enrich_rubric_list((day_data.get("lab") or {}).get("rubric"))
    node = {"node_id": node_id, "kind": kind, "title": title, "rubric": rubric}
    return node, rubric


def build_coach_context(
    *,
    enrollment_id: str | None = None,
    camp_id: str | None = None,
    learner_id: str,
    day: int,
    node_id: str | None = None,
) -> dict[str, Any]:
    """Resolve a course/enrollment/node/attempt-scoped context for the AI coach.

    ``learner_id`` (and ``camp_id``, when known) must already be
    session-verified by the caller — this function never trusts an
    unauthenticated identifier. Callers may pass either ``enrollment_id`` or
    ``camp_id`` (or both); whichever is missing is best-effort resolved from
    the other.

    Every DB lookup here degrades to an empty/``None`` value on missing data
    (new learner, no camp yet, no course version published) rather than
    raising, so the caller can always build *some* context — required for the
    offline-diagnosis degradation path to work even for a brand new learner.
    """
    if not learner_id:
        raise ValueError("learner_id is required")

    resolved_camp_id = camp_id
    if enrollment_id and not resolved_camp_id:
        resolved_camp_id = _resolve_camp_id_from_enrollment(enrollment_id)

    resolved_enrollment_id = enrollment_id or resolve_enrollment_id(resolved_camp_id, learner_id)

    course_version_id = (
        (course_runtime.resolve_course_version_for_enrollment(resolved_enrollment_id) if resolved_enrollment_id else None)
        or course_runtime.resolve_course_version_for_camp_learner(resolved_camp_id or "", learner_id)
        or course_runtime.resolve_published_version_for_camp(resolved_camp_id or "")
    )

    day_data: dict[str, Any] | None = None
    source: str | None = None
    if course_version_id:
        day_data = course_runtime.load_day_package(course_version_id, day)
        if day_data:
            source = f"db:course_version:{course_version_id[:8]}:day-{int(day):02d}"

    day_tags: list[str] = list((day_data or {}).get("learn", {}).get("lingzhi_tags") or [])
    if not day_tags and resolved_camp_id:
        # Deterministic fallback so KB queries stay day/course-scoped even when
        # no explicit lingzhi_tags are authored — never fall back to no scope.
        day_tags = [f"camp:{resolved_camp_id}", f"day:{day}"]

    node, rubric = _node_rubric(day_data, node_id)

    quiz_failures: list[dict[str, Any]] = []
    latest_submission: dict[str, Any] | None = None
    latest_job: dict[str, Any] | None = None
    sim_summary: dict[str, Any] | None = None
    fail_count = 0
    if resolved_camp_id:
        quiz_failures = _latest_quiz_failures(learner_id, resolved_camp_id, day)
        latest_submission = _latest_submission(learner_id, resolved_camp_id, day, node_id)
        latest_job = _latest_job_summary(learner_id, resolved_camp_id)
        sim_summary = _latest_sim_summary(learner_id, resolved_camp_id, day)
        fail_count = _recent_fail_count(learner_id, resolved_camp_id, day, node_id)

    return {
        "enrollment_id": resolved_enrollment_id,
        "camp_id": resolved_camp_id,
        "learner_id": learner_id,
        "course_version_id": course_version_id,
        "day": day,
        "node_id": node_id,
        "node": node,
        "rubric": rubric,
        "day_tags": day_tags,
        "quiz_failures": quiz_failures,
        "fail_count": fail_count,
        "latest_submission": latest_submission,
        "latest_eval": (latest_submission or {}).get("eval_json") if latest_submission else None,
        "latest_submission_id": (latest_submission or {}).get("id") if latest_submission else None,
        "latest_job_summary": latest_job,
        "sim_summary": sim_summary,
        "source": source,
    }


def build_diagnosis(ctx: dict[str, Any]) -> dict[str, Any]:
    """Deterministic (LLM-free) Chinese diagnosis from rubric/quiz failures.

    Always available — even when anyCode and lingzhi are both unreachable —
    because rubric checks already carry Chinese titles/suggestions via
    ``services.shared.rubric_registry``. This is the M5 offline-degradation
    guarantee: ``mode`` is always ``"offline"`` here since no LLM is called.
    """
    error_tags: list[str] = []
    reasons: list[str] = []
    latest_eval = ctx.get("latest_eval") or {}
    checks = latest_eval.get("checks") if isinstance(latest_eval, dict) else None
    lab_failed = False
    if isinstance(checks, list):
        for c in checks:
            if not isinstance(c, dict) or c.get("ok"):
                continue
            lab_failed = True
            cid = c.get("id") or c.get("check") or c.get("check_id")
            if cid:
                error_tags.append(str(cid))
            if c.get("suggestion"):
                reasons.append(str(c["suggestion"]))

    quiz_failures = ctx.get("quiz_failures") or []
    quiz_failed = bool(quiz_failures)
    if quiz_failed:
        error_tags.append("quiz:未达通过线")

    fail_count = int(ctx.get("fail_count") or 0)
    node_id = ctx.get("node_id")

    if fail_count >= 3:
        next_action = "ask_mentor"
        next_node_hint = node_id
        summary = "已多次未通过，建议申请导师复核，并附上你的产物与已尝试的修改。"
    elif lab_failed:
        next_action = "retry_lab"
        next_node_hint = node_id
        summary = "；".join(reasons) or "Lab 未通过验收标准，请对照 Rubric 修改后重新提交。"
    elif quiz_failed:
        next_action = "reread_capsule"
        next_node_hint = node_id
        summary = "测验未达通过线，建议先回顾本日学习胶囊要点后重考。"
    else:
        next_action = "continue"
        next_node_hint = None
        summary = "暂无失败记录，可继续当前学习节奏。"

    return {
        "mode": "offline",
        "diagnosis_zh": summary,
        "error_tags": sorted(set(error_tags)),
        "next_action": next_action,
        "next_action_zh": NEXT_ACTION_ZH.get(next_action, next_action),
        "next_node_hint": next_node_hint,
        "fail_count": fail_count,
    }
