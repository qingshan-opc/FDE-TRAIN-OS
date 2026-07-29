"""Integration — PostgreSQL lease queue (FOR UPDATE SKIP LOCKED)."""

from __future__ import annotations

import pytest

from services.domain import jobs as queue


@pytest.mark.usefixtures("require_postgres")
def test_enqueue_claim_and_events(unique_suffix: str):
    job_id = queue.enqueue_job(
        "agent_job",
        {"camp_id": "camp-v03", "learner_id": f"test-{unique_suffix}", "prompt": "ping"},
        camp_id="camp-v03",
        learner_id=None,
    )
    found = None
    for _ in range(20):
        claimed = queue.claim_next_job(["agent_job"], lease_seconds=30)
        if not claimed:
            break
        if claimed["id"] == job_id:
            found = claimed
            break
        # drain unrelated queued agent jobs left by previous runs
        queue.update_job(claimed["id"], status="cancelled")
        queue.append_event(claimed["id"], "cancelled", "test drain")
    assert found is not None, "failed to claim enqueued job"
    events = queue.list_events(job_id)
    types = [e["event_type"] for e in events]
    assert "queued" in types
    assert "claimed" in types
    queue.update_job(job_id, status="succeeded", result_json={"ok": True})
    queue.append_event(job_id, "done", "test done")
    row = queue.get_job(job_id)
    assert row["status"] == "succeeded"
    assert any(e["event_type"] == "done" for e in queue.list_events(job_id))


@pytest.mark.usefixtures("require_postgres")
def test_claim_skips_non_matching_kind(unique_suffix: str):
    job_id = queue.enqueue_job(
        "document_ingest",
        {"document_id": f"doc-{unique_suffix}"},
        camp_id="camp-v03",
    )
    claimed = queue.claim_next_job(["agent_job"], lease_seconds=10)
    if claimed:
        assert claimed["kind"] == "agent_job"
        assert claimed["id"] != job_id
    # cleanup: mark our doc job cancelled so it does not block later runs forever
    queue.update_job(job_id, status="cancelled")
