"""EvalBridge — unify agent rubric + sim.evaluate; learner from session."""

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

from services.shared import db_cursor, now_iso  # noqa: E402
from services.shared.middleware import resolve_camp_id, session_learner_id  # noqa: E402
from services.shared.rubric_registry import attach_rubric_args, enrich_eval_result  # noqa: E402

router = APIRouter(tags=["eval"])
app = FastAPI(title="FDE EvalBridge", version="0.2.0")


class EvalRequest(BaseModel):
    runner: str  # agent | sim
    rubric: list[dict[str, Any]] = Field(default_factory=list)
    job_id: str | None = None
    sim_session_id: str | None = None
    learner_id: str | None = None  # ignored — session wins
    camp_id: str | None = None
    day: int | None = None
    node_id: str | None = None
    write_evidence: bool = True
    idempotency_key: str | None = None


class CompleteLabRequest(BaseModel):
    camp_id: str | None = None
    day: int
    node_id: str
    job_id: str | None = None
    eval_result: dict[str, Any] = Field(default_factory=dict)
    snapshot_id: str | None = None
    # ignored — session wins
    learner_id: str | None = None


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "eval-bridge"}


@router.post("/api/v1/eval/run")
def run_eval(body: EvalRequest, request: Request) -> dict[str, Any]:
    learner_id = session_learner_id(request)

    if body.idempotency_key:
        with db_cursor() as cur:
            cur.execute("SELECT response_json FROM idempotency_keys WHERE key=?", (body.idempotency_key,))
            row = cur.fetchone()
            if row:
                resp = row["response_json"]
                return json.loads(resp) if isinstance(resp, str) else resp

    if body.runner == "agent":
        if not body.job_id:
            raise HTTPException(400, "job_id required for agent eval")
        from services.agent_gateway.app import EvaluateBody, evaluate_job

        result = evaluate_job(body.job_id, EvaluateBody(rubric=body.rubric), request)
    elif body.runner == "sim":
        if not body.sim_session_id:
            raise HTTPException(400, "sim_session_id required")
        # sim-router lives in a hyphenated dir; import via the proper package re-export
        from services.sim_router.app import evaluate as sim_evaluate
        from pydantic import BaseModel as _BM

        class _Eval(_BM):
            rubric: list[dict[str, Any]] = Field(default_factory=list)

        result = sim_evaluate(body.sim_session_id, _Eval(rubric=body.rubric), request)
    else:
        raise HTTPException(400, f"unknown runner {body.runner}")

    # Explainable eval (M3): attach args (evaluators don't echo them back) and
    # add Chinese title/expectation/suggestion per check. Idempotent, so this
    # is safe even if the underlying runner already enriched its own result.
    result = enrich_eval_result(attach_rubric_args(result, body.rubric))

    evidence_id = None
    if body.write_evidence:
        eid = str(uuid4())
        # natural idempotency: skip if same learner/day/node/kind+job already exists
        with db_cursor() as cur:
            if body.job_id:
                cur.execute(
                    """
                    SELECT id FROM evidence
                    WHERE learner_id=? AND day=? AND node_id=? AND kind=?
                      AND payload_json LIKE ?
                    LIMIT 1
                    """,
                    (
                        learner_id,
                        body.day or 1,
                        body.node_id or "lab",
                        "agent" if body.runner == "agent" else "sim",
                        f"%{body.job_id}%",
                    ),
                )
                existing = cur.fetchone()
                if existing:
                    evidence_id = existing["id"]
                else:
                    cur.execute(
                        """
                        INSERT INTO evidence (id, ts, learner_id, camp_version, day, node_id, kind, payload_json, capability_tags)
                        VALUES (?,?,?,?,?,?,?,?,?)
                        """,
                        (
                            eid,
                            now_iso(),
                            learner_id,
                            "v0.3",
                            body.day or 1,
                            body.node_id or "lab",
                            "agent" if body.runner == "agent" else "sim",
                            json.dumps(
                                {"eval": result, "job_id": body.job_id, "sim_session_id": body.sim_session_id},
                                ensure_ascii=False,
                            ),
                            json.dumps(
                                [f"eval:{body.runner}", "pass" if result.get("pass") else "fail"],
                                ensure_ascii=False,
                            ),
                        ),
                    )
                    evidence_id = eid
            else:
                cur.execute(
                    """
                    INSERT INTO evidence (id, ts, learner_id, camp_version, day, node_id, kind, payload_json, capability_tags)
                    VALUES (?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        eid,
                        now_iso(),
                        learner_id,
                        "v0.3",
                        body.day or 1,
                        body.node_id or "lab",
                        "agent" if body.runner == "agent" else "sim",
                        json.dumps(
                            {"eval": result, "sim_session_id": body.sim_session_id},
                            ensure_ascii=False,
                        ),
                        json.dumps(
                            [f"eval:{body.runner}", "pass" if result.get("pass") else "fail"],
                            ensure_ascii=False,
                        ),
                    ),
                )
                evidence_id = eid

    out = {"result": result, "evidence_id": evidence_id, "learner_id": learner_id}
    if body.idempotency_key:
        with db_cursor() as cur:
            cur.execute(
                """
                INSERT INTO idempotency_keys (key, scope, response_json, created_at)
                VALUES (?, 'eval.run', ?::jsonb, NOW())
                ON CONFLICT (key) DO NOTHING
                """,
                (body.idempotency_key, json.dumps(out, ensure_ascii=False)),
            )
    return out


@router.post("/api/v1/labs/complete")
def complete_lab(body: CompleteLabRequest, request: Request) -> dict[str, Any]:
    """Atomic lab completion (M3): one call replaces the previous
    evidence-write + submission-write + node-complete round trip, so a
    mid-flight failure can no longer desync progress from the evidence trail.
    See :mod:`services.application.lab_completion`.
    """
    from services.application.lab_completion import complete_lab_attempt

    learner_id = session_learner_id(request)
    camp_id = resolve_camp_id(request, body.camp_id)
    if not body.eval_result:
        raise HTTPException(400, "eval_result required")

    day_data: dict[str, Any] | None = None
    try:
        # Orchestrator private loader — reused rather than duplicated so the
        # "which node unlocks next" logic has exactly one implementation.
        from services.orchestrator.app import _load_day_package

        day_data, _ = _load_day_package(body.day, camp_id, learner_id)
    except Exception:
        day_data = None

    result = complete_lab_attempt(
        learner_id=learner_id,
        camp_id=camp_id,
        day=body.day,
        node_id=body.node_id,
        eval_result=body.eval_result,
        job_id=body.job_id,
        snapshot_id=body.snapshot_id,
        day_data=day_data,
    )
    return {**result, "learner_id": learner_id, "camp_id": camp_id}


app.include_router(router)
