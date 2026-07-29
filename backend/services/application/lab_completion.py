"""Atomic lab-attempt completion (M3).

Before this module, finishing a lab required three independent client calls
(``POST /api/v1/evidence``, ``POST /api/v1/submissions``,
``POST /api/v1/nodes/{id}/complete``) each opening its own DB transaction —
a mid-flight failure could leave progress unlocked without a submission
record, or vice versa. :func:`complete_lab_attempt` does the equivalent
writes (submission + evidence + node_progress, plus unlocking the next node
on pass) inside a single ``db_cursor()`` transaction, so it either all lands
or none of it does.
"""

from __future__ import annotations

import json
from typing import Any
from uuid import uuid4

from services.shared import db_cursor, now_iso
from services.shared.config import CAMP_VERSION_LABEL
from services.shared.rubric_registry import enrich_eval_result

CAMP_VERSION_DEFAULT = CAMP_VERSION_LABEL


def _node_ids_for_day(day_data: dict[str, Any] | None, day: int) -> list[str]:
    if not day_data:
        return []
    kinds = [(n.get("type") or n.get("kind")) for n in (day_data.get("nodes") or [])]
    return [f"d{day}-{k}" for k in kinds if k]


def _evidence_kind(day_data: dict[str, Any] | None, job_id: str | None) -> str:
    """Agent-vs-sim evidence kind, matching `eval_bridge`'s convention.

    An Agent Lab completion must land as ``kind="agent"`` (not the legacy
    ``"lab"``) so the passport's agent-track detection (and any downstream
    capability-tag/cert logic keyed on evidence kind) sees it consistently
    regardless of whether the attempt went through `/api/v1/eval/run` or this
    atomic `/api/v1/labs/complete` path. Falls back to ``job_id`` presence
    (only the agent runner produces one) when the day package's runner is
    unknown, e.g. in unit tests that don't pass ``day_data``.
    """
    lab_cfg = (day_data or {}).get("lab") or {}
    runner = lab_cfg.get("runner") or ("sim" if lab_cfg.get("sim_kind") else "agent" if lab_cfg.get("agent") else None)
    if not runner:
        runner = "agent" if job_id else "sim"
    return "agent" if runner == "agent" else "sim"


def complete_lab_attempt(
    *,
    learner_id: str,
    camp_id: str,
    day: int,
    node_id: str,
    eval_result: dict[str, Any],
    job_id: str | None = None,
    snapshot_id: str | None = None,
    day_data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Persist a lab attempt's submission/evidence/progress atomically.

    Args:
        learner_id: session-verified learner id (never trust client input).
        camp_id: session-verified camp id.
        day: day index.
        node_id: e.g. ``"d3-lab"``.
        eval_result: raw or already-enriched ``{"pass", "checks", "score"}``.
        job_id: agent job id, when the attempt ran through the agent runner.
        snapshot_id: workspace snapshot id at time of completion, if known.
        day_data: the day's package dict (for computing which node unlocks
            next); when omitted, progress is still written but no node is
            unlocked (caller/route is expected to unlock separately, e.g. via
            the orchestrator, in that case).

    Returns a summary dict with the created submission/evidence ids and the
    resulting node status. Raises on DB failure — the caller's HTTP layer is
    expected to translate that into a 5xx; nothing partial is left behind
    because every write happens on one connection/transaction.
    """
    passed = bool(eval_result.get("pass"))
    enriched = enrich_eval_result(dict(eval_result))

    submission_id = str(uuid4())
    evidence_id = str(uuid4())
    ts = now_iso()
    unlocked_next: str | None = None
    evidence_kind = _evidence_kind(day_data, job_id)

    with db_cursor() as cur:
        # 1) submission — idempotent per (learner, camp, day, node, job)
        cur.execute(
            """
            INSERT INTO submissions
              (id, camp_id, learner_id, day, node_id, job_id, snapshot_id, eval_json, status, created_at)
            VALUES (?,?,?,?,?,?,?,?::jsonb,?,NOW())
            ON CONFLICT (learner_id, camp_id, day, node_id, job_id) DO UPDATE
              SET eval_json=EXCLUDED.eval_json, snapshot_id=EXCLUDED.snapshot_id, status=EXCLUDED.status
            RETURNING id
            """,
            (
                submission_id,
                camp_id,
                learner_id,
                day,
                node_id,
                job_id,
                snapshot_id,
                json.dumps(enriched, ensure_ascii=False),
                "passed" if passed else "failed",
            ),
        )
        row = cur.fetchone()
        submission_id = row["id"] if row else submission_id

        # 2) evidence — always recorded, pass or fail, for a full audit trail
        cur.execute(
            """
            INSERT INTO evidence
              (id, ts, learner_id, camp_version, day, node_id, kind, payload_json, capability_tags)
            VALUES (?,?,?,?,?,?,?,?,?)
            """,
            (
                evidence_id,
                ts,
                learner_id,
                CAMP_VERSION_DEFAULT,
                day,
                node_id,
                evidence_kind,
                json.dumps(
                    {"eval": enriched, "job_id": job_id, "snapshot_id": snapshot_id, "submission_id": submission_id},
                    ensure_ascii=False,
                ),
                json.dumps([f"eval:{evidence_kind}", "pass" if passed else "fail", f"day:{day}"], ensure_ascii=False),
            ),
        )

        # 3) progress — only advance the gate on pass
        if passed:
            cur.execute(
                "SELECT 1 FROM node_progress WHERE learner_id=? AND camp_id=? AND day=? AND node_id=?",
                (learner_id, camp_id, day, node_id),
            )
            if cur.fetchone():
                cur.execute(
                    """
                    UPDATE node_progress SET status='passed', updated_at=NOW()
                    WHERE learner_id=? AND camp_id=? AND day=? AND node_id=?
                    """,
                    (learner_id, camp_id, day, node_id),
                )
            else:
                cur.execute(
                    """
                    INSERT INTO node_progress (learner_id, camp_id, day, node_id, status, updated_at)
                    VALUES (?,?,?,?,'passed',NOW())
                    """,
                    (learner_id, camp_id, day, node_id),
                )

            ids = _node_ids_for_day(day_data, day)
            if node_id in ids:
                idx = ids.index(node_id)
                if idx + 1 < len(ids):
                    unlocked_next = ids[idx + 1]
                    cur.execute(
                        "SELECT status FROM node_progress WHERE learner_id=? AND camp_id=? AND day=? AND node_id=?",
                        (learner_id, camp_id, day, unlocked_next),
                    )
                    nrow = cur.fetchone()
                    if not nrow:
                        cur.execute(
                            """
                            INSERT INTO node_progress (learner_id, camp_id, day, node_id, status, updated_at)
                            VALUES (?,?,?,?,'available',NOW())
                            """,
                            (learner_id, camp_id, day, unlocked_next),
                        )
                    elif nrow["status"] == "locked":
                        cur.execute(
                            """
                            UPDATE node_progress SET status='available', updated_at=NOW()
                            WHERE learner_id=? AND camp_id=? AND day=? AND node_id=?
                            """,
                            (learner_id, camp_id, day, unlocked_next),
                        )

    return {
        "submission_id": submission_id,
        "evidence_id": evidence_id,
        "node_id": node_id,
        "status": "passed" if passed else "failed",
        "unlocked": unlocked_next,
        "eval_result": enriched,
    }
