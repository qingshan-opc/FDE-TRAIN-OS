"""FDE background worker — agent jobs + document ingest."""

from __future__ import annotations

import hashlib
import json
import logging
import sys
import time
from pathlib import Path
from typing import Any

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from services.domain import jobs as queue  # noqa: E402
from services.shared import (  # noqa: E402
    AGENT_MODE,
    DOCUMENT_MAX_BYTES,
    LINGZHI_BASE_URL,
    LINGZHI_CLIENT_TOKEN,
    LINGZHI_SOURCE_ID,
    WORKSPACE_MAX_BYTES,
    init_schema,
    now_iso,
    resolve_safe,
    setup_logging,
)
from services.shared.config import CLAMAV_ENABLED, MAX_JOB_ATTEMPTS, JOB_BACKOFF_BASE_SEC, S3_BUCKET_DOCUMENTS, S3_BUCKET_WORKSPACES  # noqa: E402
from services.shared.db import db_cursor  # noqa: E402
from services.storage import (  # noqa: E402
    get_store,
    hydrate_workspace,
    snapshot_workspace,
    temp_workspace,
)

log = logging.getLogger("fde.worker")
PARSER_VERSION = "fde-parser-1.0"


class JobCancelled(RuntimeError):
    """Raised cooperatively when a job's status flips to 'cancelled' mid-flight."""


def _scan_clamav(data: bytes) -> str:
    """Fail-closed: when CLAMAV_ENABLED=1, any scan failure/unavailability raises
    and aborts the ingest — we never treat "could not scan" as "safe to ingest"."""
    if not CLAMAV_ENABLED:
        return "skipped"
    try:
        import clamd

        cd = clamd.ClamdUnixSocket()
        result = cd.instream(data)  # type: ignore[arg-type]
        status = (result or {}).get("stream", ("UNKNOWN",))[0]
        if status == "FOUND":
            raise RuntimeError("malware detected: clamav FOUND")
        return status
    except Exception as exc:
        log.error("clamav scan failed/unavailable, failing closed (ingest aborted): %s", exc)
        raise RuntimeError(f"clamav scan unavailable/failed: {exc}") from exc


def _extract_text(filename: str, data: bytes) -> str:
    name = filename.lower()
    if name.endswith(".docx"):
        from io import BytesIO
        from docx import Document

        doc = Document(BytesIO(data))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    if name.endswith(".pdf"):
        from io import BytesIO
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(data))
        parts = []
        for page in reader.pages:
            parts.append(page.extract_text() or "")
        return "\n".join(parts)
    if name.endswith((".md", ".txt")):
        return data.decode("utf-8", errors="ignore")
    raise ValueError(f"unsupported document type: {filename}")


def _stub_write(ws: Path, prompt: str) -> dict[str, Any]:
    # Reuse agent gateway stub logic lightly
    from services.agent_gateway.app import _stub_write as stub

    return stub(ws, prompt)


def _run_anycode(ws: Path, prompt: str, *, job_id: str | None = None, skills: list[str] | None = None) -> dict[str, Any]:
    from services.shared.anycode_client import anycode_base, anycode_healthy, run_turn

    if AGENT_MODE == "stub":
        return _stub_write(ws, prompt)
    if not anycode_base():
        raise RuntimeError("ANYCODE_DASHBOARD_URL missing")
    if not anycode_healthy():
        if AGENT_MODE == "live":
            raise RuntimeError("anyCode Workbench unreachable (AGENT_MODE=live)")
        return _stub_write(ws, prompt)

    def on_event(ev_name: str, payload: dict[str, Any]) -> None:
        if not job_id:
            return
        kind = str(payload.get("kind") or ev_name)
        text = payload.get("text")
        detail = kind
        if kind == "assistant_delta" and text:
            detail = f"delta:{str(text)[:120]}"
        elif kind == "tool_start":
            detail = f"tool:{payload.get('tool_name') or payload.get('tool_key') or 'tool'}"
        elif text:
            detail = f"{kind}:{str(text)[:160]}"
        try:
            queue.append_event(job_id, "anycode", detail[:500])
        except Exception:
            pass

    try:
        result = run_turn(
            root_path=ws,
            project_name=f"fde-{ws.name}",
            prompt=prompt,
            skills=skills or None,
            on_event=on_event,
        )
    except Exception as exc:
        if AGENT_MODE == "live":
            raise RuntimeError(f"anyCode turn failed: {exc}") from exc
        log.warning("anyCode failed, falling back to stub: %s", exc)
        return _stub_write(ws, prompt)

    if result.get("status") == "session_error" and AGENT_MODE == "live":
        raise RuntimeError(result.get("error") or "anyCode session_error")

    files = [p.name for p in ws.iterdir() if p.is_file()]
    return {
        "files": files,
        "runner": "anycode",
        "project_id": result.get("project_id"),
        "session_id": result.get("session_id"),
        "turn_status": result.get("status"),
        "reply_preview": (result.get("reply") or "")[:500],
    }


def handle_agent_job(job: dict[str, Any]) -> None:
    job_id = job["id"]
    payload = job.get("payload_json") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    camp_id = payload["camp_id"]
    learner_id = payload["learner_id"]
    prompt = payload["prompt"]
    skills = payload.get("skills")
    if isinstance(skills, str):
        skills = [skills]
    queue.update_job(job_id, status="hydrating")
    queue.append_event(job_id, "hydrating", "hydrate workspace from MinIO")
    # current head
    with db_cursor() as cur:
        cur.execute(
            "SELECT snapshot_id FROM workspace_heads WHERE camp_id=? AND learner_id=?",
            (camp_id, learner_id),
        )
        head = cur.fetchone()
        snapshot_id = head["snapshot_id"] if head else None
    ws = temp_workspace(camp_id, learner_id, job_id)
    hydrate_workspace(camp_id, learner_id, snapshot_id, ws)
    if queue.is_cancelled(job_id):
        raise JobCancelled("cancelled after hydrate")
    queue.heartbeat(job_id)
    queue.update_job(job_id, status="running")
    queue.append_event(job_id, "running", "agent executing")
    if queue.is_cancelled(job_id):
        raise JobCancelled("cancelled before anycode")
    if payload.get("force_stub"):
        result = _stub_write(ws, prompt)
    else:
        result = _run_anycode(ws, prompt, job_id=job_id, skills=skills if isinstance(skills, list) else None)
    if queue.is_cancelled(job_id):
        raise JobCancelled("cancelled after anycode")
    size = sum(p.stat().st_size for p in ws.rglob("*") if p.is_file())
    if size > WORKSPACE_MAX_BYTES:
        raise RuntimeError("workspace quota exceeded")
    queue.update_job(job_id, status="snapshotting")
    queue.append_event(job_id, "snapshotting", "upload snapshot")
    snap = snapshot_workspace(camp_id, learner_id, ws, parent_id=snapshot_id, job_id=job_id)
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO workspace_snapshots (id, camp_id, learner_id, parent_id, manifest_key, object_prefix, size_bytes, file_count, created_by_job_id)
            VALUES (?,?,?,?,?,?,?,?,?)
            """,
            (
                snap["id"],
                camp_id,
                learner_id,
                snap.get("parent_id"),
                snap["manifest_key"],
                snap["object_prefix"],
                snap["size_bytes"],
                snap["file_count"],
                job_id,
            ),
        )
        cur.execute(
            """
            INSERT INTO workspace_heads (camp_id, learner_id, snapshot_id, version, updated_at)
            VALUES (?, ?, ?, 1, NOW())
            ON CONFLICT (camp_id, learner_id) DO UPDATE
            SET snapshot_id=EXCLUDED.snapshot_id, version=workspace_heads.version+1, updated_at=NOW()
            """,
            (camp_id, learner_id, snap["id"]),
        )
        # bridge legacy agent_jobs if present
        legacy_id = payload.get("legacy_job_id")
        if legacy_id:
            cur.execute(
                "UPDATE agent_jobs SET status=?, result_json=?, artifact_uri=?, workspace_snapshot_id=?, updated_at=? WHERE id=?",
                (
                    "succeeded",
                    json.dumps(result, ensure_ascii=False),
                    f"s3://{S3_BUCKET_WORKSPACES}/{snap['object_prefix']}",
                    snap["id"],
                    now_iso(),
                    legacy_id,
                ),
            )
    queue.update_job(job_id, status="succeeded", result_json={**result, "snapshot_id": snap["id"]})
    queue.append_event(job_id, "done", "succeeded", {"snapshot_id": snap["id"]})


def handle_document_ingest(job: dict[str, Any]) -> None:
    import httpx

    job_id = job["id"]
    payload = job.get("payload_json") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    document_id = payload["document_id"]
    with db_cursor() as cur:
        cur.execute("SELECT * FROM documents WHERE id=?", (document_id,))
        doc = cur.fetchone()
    if not doc:
        raise RuntimeError("document not found")
    queue.update_job(job_id, status="ingesting")
    store = get_store()
    data = store.get_bytes(S3_BUCKET_DOCUMENTS, doc["object_key"])
    if len(data) > DOCUMENT_MAX_BYTES:
        raise RuntimeError("document too large")
    scan = _scan_clamav(data)
    with db_cursor() as cur:
        cur.execute("UPDATE documents SET scan_status=?, status='queued', updated_at=NOW() WHERE id=?", (scan, document_id))
    text = _extract_text(doc["filename"], data)
    content_sha = hashlib.sha256(text.encode("utf-8")).hexdigest()
    token = LINGZHI_CLIENT_TOKEN
    source_id = LINGZHI_SOURCE_ID
    if not token or not source_id:
        # offline mode: mark ready with local extract only
        with db_cursor() as cur:
            cur.execute(
                """
                UPDATE documents SET status='ready', parser_version=?, error_message=?, updated_at=NOW()
                WHERE id=?
                """,
                (PARSER_VERSION, "LINGZHI_CLIENT_TOKEN/SOURCE_ID missing — local ready only", document_id),
            )
        queue.update_job(job_id, status="succeeded", result_json={"mode": "offline", "chars": len(text)})
        queue.append_event(job_id, "done", "offline ready", {"chars": len(text)})
        return
    headers = {"X-Client-Token": token}
    with httpx.Client(timeout=60.0) as client:
        check = client.post(
            f"{LINGZHI_BASE_URL}/api/v1/ingest/files/check",
            headers=headers,
            json={
                "source_id": source_id,
                "files": [
                    {
                        "relative_path": f"fde/{doc['camp_id']}/{doc['filename']}",
                        "content_sha256": content_sha,
                        "size_bytes": len(text.encode("utf-8")),
                    }
                ],
            },
        )
        check.raise_for_status()
        pub = client.post(
            f"{LINGZHI_BASE_URL}/api/v1/ingest/publish",
            headers=headers,
            json={
                "source_id": source_id,
                "relative_path": f"fde/{doc['camp_id']}/{doc['filename']}",
                "content_sha256": content_sha,
                "size_bytes": len(text.encode("utf-8")),
                "title": doc["filename"],
                "client_extraction": {"content": text, "extractor": PARSER_VERSION},
            },
        )
        pub.raise_for_status()
        body = pub.json()
        lingzhi_job = body.get("job_id")
        knowledge_id = body.get("knowledge_id")
        file_id = body.get("file_id")
        with db_cursor() as cur:
            cur.execute(
                """
                UPDATE documents SET status='ingesting', lingzhi_job_id=?, lingzhi_knowledge_id=?, lingzhi_file_id=?,
                  parser_version=?, updated_at=NOW() WHERE id=?
                """,
                (lingzhi_job, knowledge_id, file_id, PARSER_VERSION, document_id),
            )
        # poll
        status = body.get("status") or "queued"
        for _ in range(60):
            if not lingzhi_job:
                break
            jr = client.get(f"{LINGZHI_BASE_URL}/api/v1/ingest/jobs/{lingzhi_job}", headers=headers)
            if jr.status_code < 400:
                j = jr.json()
                status = j.get("status") or status
                if status in ("completed", "failed", "dead_letter"):
                    break
            time.sleep(2)
            queue.heartbeat(job_id)
        final = "ready" if status == "completed" else ("failed" if status in ("failed", "dead_letter") else "ready")
        with db_cursor() as cur:
            cur.execute(
                "UPDATE documents SET status=?, updated_at=NOW(), error_message=? WHERE id=?",
                (final, None if final == "ready" else f"lingzhi status={status}", document_id),
            )
        queue.update_job(
            job_id,
            status="succeeded" if final == "ready" else "failed",
            result_json={"knowledge_id": knowledge_id, "file_id": file_id, "lingzhi_status": status},
        )
        queue.append_event(job_id, "done", final, {"knowledge_id": knowledge_id})


HANDLERS = {
    "agent_job": handle_agent_job,
    "document_ingest": handle_document_ingest,
}


def loop(poll_seconds: float = 1.0) -> None:
    setup_logging()
    init_schema()
    log.info("worker started AGENT_MODE=%s", AGENT_MODE)
    while True:
        job = queue.claim_next_job(list(HANDLERS.keys()))
        if not job:
            time.sleep(poll_seconds)
            continue
        job_id = job["id"]
        kind = job["kind"]
        handler = HANDLERS.get(kind)
        try:
            if not handler:
                raise RuntimeError(f"unknown kind {kind}")
            handler(job)
        except JobCancelled as exc:
            # cooperative cancel: cancel_job() already set status='cancelled' and
            # appended its own event — just log the checkpoint where we stopped.
            log.info("job %s cancelled cooperatively: %s", job_id, exc)
            queue.append_event(job_id, "cancelled", str(exc))
        except Exception as exc:
            log.exception("job failed %s", job_id)
            queue.update_job(job_id, status="failed", error_message=str(exc))
            queue.append_event(job_id, "error", str(exc))
            queue.requeue_failed(max_attempts=MAX_JOB_ATTEMPTS, backoff_base=JOB_BACKOFF_BASE_SEC)
            payload = job.get("payload_json") or {}
            if isinstance(payload, str):
                payload = json.loads(payload)
            if kind == "document_ingest" and payload.get("document_id"):
                with db_cursor() as cur:
                    cur.execute(
                        "UPDATE documents SET status='failed', error_message=?, updated_at=NOW() WHERE id=?",
                        (str(exc), payload["document_id"]),
                    )


def main() -> None:
    loop()


if __name__ == "__main__":
    main()
