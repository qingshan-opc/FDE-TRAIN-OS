"""PostgreSQL lease-based job queue."""

from __future__ import annotations

import json
import socket
import uuid
from typing import Any

from services.shared.db import db_cursor
from services.shared import now_iso


def _worker_id() -> str:
    return f"{socket.gethostname()}-{uuid.uuid4().hex[:8]}"


def enqueue_job(kind: str, payload: dict[str, Any], *, camp_id: str | None = None, learner_id: str | None = None) -> str:
    job_id = str(uuid.uuid4())
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO jobs (id, kind, status, camp_id, learner_id, payload_json, created_at, updated_at)
            VALUES (?, ?, 'queued', ?, ?, ?::jsonb, ?, ?)
            """,
            (job_id, kind, camp_id, learner_id, json.dumps(payload, ensure_ascii=False), now_iso(), now_iso()),
        )
        append_event(job_id, "queued", "job enqueued", {"kind": kind}, cur=cur)
    return job_id


def append_event(
    job_id: str,
    event_type: str,
    message: str | None = None,
    payload: dict[str, Any] | None = None,
    *,
    cur=None,
) -> None:
    def _do(c):
        c.execute(
            """
            INSERT INTO job_events (job_id, event_type, message, payload_json)
            VALUES (?, ?, ?, ?::jsonb)
            """,
            (job_id, event_type, message, json.dumps(payload or {}, ensure_ascii=False)),
        )

    if cur is not None:
        _do(cur)
    else:
        with db_cursor() as c:
            _do(c)


def update_job(job_id: str, **fields: Any) -> None:
    cols, vals = [], []
    for k, v in fields.items():
        if k.endswith("_json") and isinstance(v, (dict, list)):
            cols.append(f"{k}=?::jsonb")
            vals.append(json.dumps(v, ensure_ascii=False))
        else:
            cols.append(f"{k}=?")
            vals.append(v)
    cols.append("updated_at=?")
    vals.append(now_iso())
    vals.append(job_id)
    with db_cursor() as cur:
        cur.execute(f"UPDATE jobs SET {', '.join(cols)} WHERE id=?", vals)


def claim_next_job(kinds: list[str] | None = None, lease_seconds: int = 60) -> dict[str, Any] | None:
    worker = _worker_id()
    with db_cursor() as cur:
        kind_filter = ""
        params: list[Any] = []
        if kinds:
            placeholders = ",".join(["?"] * len(kinds))
            kind_filter = f" AND kind IN ({placeholders})"
            params.extend(kinds)
        # reclaim expired leases
        cur.execute(
            f"""
            UPDATE jobs SET status='queued', locked_by=NULL, locked_until=NULL, updated_at=NOW()
            WHERE status IN ('hydrating','running','evaluating','snapshotting','ingesting')
              AND locked_until IS NOT NULL AND locked_until < NOW()
            {kind_filter}
            """,
            params,
        )
        # m0-runtime-safety: also reclaim failed jobs that never got swept by
        # requeue_failed() (e.g. worker crashed) once their backoff has elapsed.
        cur.execute(
            f"""
            UPDATE jobs SET status='queued', locked_by=NULL, locked_until=NULL, updated_at=NOW()
            WHERE status='failed' AND attempt_count < 3
              AND updated_at < NOW() - ((30 * POWER(2, GREATEST(attempt_count - 1, 0)))::text || ' seconds')::interval
            {kind_filter}
            """,
            params,
        )
        cur.execute(
            f"""
            SELECT id FROM jobs
            WHERE status='queued' {kind_filter}
            ORDER BY created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
            """,
            params,
        )
        row = cur.fetchone()
        if not row:
            return None
        job_id = row["id"]
        cur.execute(
            """
            UPDATE jobs
            SET status='running', locked_by=?, locked_until=NOW() + ((?)::text || ' seconds')::interval,
                attempt_count=attempt_count+1, updated_at=NOW()
            WHERE id=?
            RETURNING *
            """,
            (worker, str(lease_seconds), job_id),
        )
        job = cur.fetchone()
        cur.execute(
            """
            INSERT INTO job_leases (job_id, worker_id, heartbeat_at, expires_at)
            VALUES (?, ?, NOW(), NOW() + ((?)::text || ' seconds')::interval)
            ON CONFLICT (job_id) DO UPDATE
            SET worker_id=EXCLUDED.worker_id, heartbeat_at=NOW(), expires_at=EXCLUDED.expires_at
            """,
            (job_id, worker, str(lease_seconds)),
        )
        append_event(job_id, "claimed", f"claimed by {worker}", {"worker": worker}, cur=cur)
        return dict(job) if job else None


def heartbeat(job_id: str, lease_seconds: int = 60) -> None:
    with db_cursor() as cur:
        cur.execute(
            """
            UPDATE jobs SET locked_until=NOW() + ((?)::text || ' seconds')::interval, updated_at=NOW()
            WHERE id=?
            """,
            (str(lease_seconds), job_id),
        )
        cur.execute(
            """
            UPDATE job_leases SET heartbeat_at=NOW(),
              expires_at=NOW() + ((?)::text || ' seconds')::interval
            WHERE job_id=?
            """,
            (str(lease_seconds), job_id),
        )


def list_events(job_id: str, after_id: int = 0) -> list[dict[str, Any]]:
    with db_cursor() as cur:
        cur.execute(
            "SELECT id, job_id, event_type, message, payload_json, created_at FROM job_events WHERE job_id=? AND id>? ORDER BY id ASC",
            (job_id, after_id),
        )
        rows = []
        for r in cur.fetchall():
            d = dict(r)
            if isinstance(d.get("payload_json"), str):
                d["payload_json"] = json.loads(d["payload_json"])
            rows.append(d)
        return rows


def get_job(job_id: str) -> dict[str, Any] | None:
    with db_cursor() as cur:
        cur.execute("SELECT * FROM jobs WHERE id=?", (job_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def is_cancelled(job_id: str) -> bool:
    """Cooperative cancellation check — the worker polls this between stages and
    must stop as soon as it observes status='cancelled' (set by cancel_job)."""
    with db_cursor() as cur:
        cur.execute("SELECT status FROM jobs WHERE id=?", (job_id,))
        row = cur.fetchone()
        return bool(row) and row["status"] == "cancelled"


def requeue_failed(max_attempts: int = 3, backoff_base: int = 30) -> dict[str, int]:
    """Sweep jobs currently marked 'failed': requeue with exponential backoff when
    attempt_count < max_attempts, otherwise move to 'dead_letter'. Safe to call after
    marking a single job failed (it will also pick up any other stragglers) or on a
    periodic sweep. backoff_base is in seconds; delay grows as backoff_base * 2^(n-1).
    """
    with db_cursor() as cur:
        cur.execute(
            """
            UPDATE jobs SET status='dead_letter', updated_at=NOW()
            WHERE status='failed' AND attempt_count >= ?
            RETURNING id
            """,
            (max_attempts,),
        )
        dead_rows = cur.fetchall()
        for row in dead_rows:
            append_event(row["id"], "dead_letter", "max attempts exceeded", cur=cur)

        cur.execute(
            """
            UPDATE jobs
            SET status='queued', locked_by=NULL,
                locked_until=NOW() + ((? * POWER(2, GREATEST(attempt_count - 1, 0)))::text || ' seconds')::interval,
                updated_at=NOW()
            WHERE status='failed' AND attempt_count < ?
            RETURNING id
            """,
            (backoff_base, max_attempts),
        )
        requeued_rows = cur.fetchall()
        for row in requeued_rows:
            append_event(row["id"], "requeued", "retry after backoff", cur=cur)
    return {"requeued": len(requeued_rows), "dead_letter": len(dead_rows)}
