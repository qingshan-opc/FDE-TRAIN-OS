"""Certificate issuance / verify / revoke integration tests (require live PostgreSQL + MinIO).

Builds a minimal course_version + day_packages + course_offering +
enrollment_records fixture per test, drives
`services.application.certificates` directly (no HTTP layer), and cleans up
every row it created.
"""

from __future__ import annotations

import json
import uuid
from uuid import uuid4

import pytest

from services.shared import db_cursor, now_iso
from services.shared.seed import hash_password


@pytest.fixture
def cert_ctx(require_postgres, require_minio):
    suffix = uuid.uuid4().hex[:8]
    user_id = str(uuid4())
    camp_id = f"testcamp-cert-{suffix}"
    course_version_id = str(uuid4())
    offering_id = str(uuid4())
    enrollment_id = str(uuid4())

    with db_cursor() as cur:
        cur.execute(
            "INSERT INTO users (id, email, password_hash, display_name, role, created_at) VALUES (?,?,?,?,?,?)",
            (user_id, f"cert-{suffix}@fde.local", hash_password("x" + suffix), f"Cert {suffix}", "learner", now_iso()),
        )
    with db_cursor() as cur:
        cur.execute("INSERT INTO camps (id, name, version) VALUES (?,?, 'v0.3')", (camp_id, f"Cert Camp {suffix}"))
    with db_cursor() as cur:
        cur.execute(
            "INSERT INTO course_versions (id, camp_id, version_tag, status, title, created_at) VALUES (?,?,?,?,?,NOW())",
            (course_version_id, camp_id, f"v-{suffix}", "published", "Cert Course"),
        )
        for day in (1, 2):
            cur.execute(
                "INSERT INTO day_packages (id, course_version_id, day, title, package_json) VALUES (?,?,?,?,?::jsonb)",
                (str(uuid4()), course_version_id, day, f"Day {day}", json.dumps({})),
            )
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO course_offerings (id, course_version_id, camp_id, title, status, created_at)
            VALUES (?,?,?,?, 'active', NOW())
            """,
            (offering_id, course_version_id, camp_id, "Cert Offering"),
        )
    with db_cursor() as cur:
        cur.execute(
            "INSERT INTO enrollment_records (id, user_id, offering_id, status, created_at) VALUES (?,?,?, 'active', NOW())",
            (enrollment_id, user_id, offering_id),
        )

    ctx = {
        "user_id": user_id,
        "camp_id": camp_id,
        "course_version_id": course_version_id,
        "offering_id": offering_id,
        "enrollment_id": enrollment_id,
    }
    yield ctx

    with db_cursor() as cur:
        cur.execute("DELETE FROM certificate_issuances WHERE enrollment_id=?", (enrollment_id,))
        cur.execute(
            "DELETE FROM rubric_criteria WHERE rubric_id IN (SELECT id FROM rubric_definitions WHERE course_version_id=?)",
            (course_version_id,),
        )
        cur.execute("DELETE FROM rubric_definitions WHERE course_version_id=?", (course_version_id,))
        cur.execute("DELETE FROM node_progress WHERE learner_id=? AND camp_id=?", (user_id, camp_id))
        cur.execute("DELETE FROM identity_verifications WHERE user_id=?", (user_id,))
        cur.execute("DELETE FROM enrollment_records WHERE id=?", (enrollment_id,))
        cur.execute("DELETE FROM course_offerings WHERE id=?", (offering_id,))
        cur.execute("DELETE FROM day_packages WHERE course_version_id=?", (course_version_id,))
        cur.execute("DELETE FROM course_versions WHERE id=?", (course_version_id,))
        cur.execute("DELETE FROM camps WHERE id=?", (camp_id,))
        cur.execute("DELETE FROM users WHERE id=?", (user_id,))


def _mark_verified(user_id: str) -> None:
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO identity_verifications (id, user_id, provider, verification_id, provider_ref, status, created_at, updated_at)
            VALUES (?,?,?,?,?, 'verified', NOW(), NOW())
            """,
            (str(uuid4()), user_id, "stub", "verif-1", "provider-ref-1"),
        )


def _pass_node(user_id: str, camp_id: str, day: int, node_id: str) -> None:
    with db_cursor() as cur:
        cur.execute(
            "INSERT INTO node_progress (learner_id, camp_id, day, node_id, status, updated_at) VALUES (?,?,?,?, 'passed', NOW())",
            (user_id, camp_id, day, node_id),
        )


def _add_rubric(course_version_id: str, node_key: str) -> None:
    with db_cursor() as cur:
        rid = str(uuid4())
        cur.execute(
            "INSERT INTO rubric_definitions (id, course_version_id, node_key, title, created_at) VALUES (?,?,?,?,NOW())",
            (rid, course_version_id, node_key, f"Rubric {node_key}"),
        )


def test_issue_blocked_without_identity_verification(cert_ctx):
    from services.application.certificates import CertificateError, issue_certificate

    _pass_node(cert_ctx["user_id"], cert_ctx["camp_id"], 1, "d1-lab")
    _pass_node(cert_ctx["user_id"], cert_ctx["camp_id"], 2, "d2-lab")

    with pytest.raises(CertificateError, match="身份未认证"):
        issue_certificate(cert_ctx["enrollment_id"], allow_unverified=False)


def test_issue_dev_default_allows_unverified(cert_ctx):
    """Outside prod, `allow_unverified=None` (the default) falls back to
    CERT_ALLOW_UNVERIFIED, which defaults to true when FDE_ENV != prod."""
    from services.application.certificates import issue_certificate

    _pass_node(cert_ctx["user_id"], cert_ctx["camp_id"], 1, "d1-lab")
    _pass_node(cert_ctx["user_id"], cert_ctx["camp_id"], 2, "d2-lab")

    result = issue_certificate(cert_ctx["enrollment_id"])

    assert result["status"] == "issued"
    assert result["cert_id"].startswith("FDE-")
    assert result["completion_snapshot"]["issued_unverified"] is True


def test_issue_blocked_below_completion_threshold(cert_ctx):
    from services.application.certificates import CertificateError, issue_certificate

    _mark_verified(cert_ctx["user_id"])
    _pass_node(cert_ctx["user_id"], cert_ctx["camp_id"], 1, "d1-lab")  # only 1 of 2 days

    with pytest.raises(CertificateError, match="完成度不足"):
        issue_certificate(cert_ctx["enrollment_id"])


def test_issue_blocked_by_pending_required_rubric(cert_ctx):
    from services.application.certificates import CertificateError, issue_certificate

    _mark_verified(cert_ctx["user_id"])
    _pass_node(cert_ctx["user_id"], cert_ctx["camp_id"], 1, "d1-review")  # day complete, but...
    _pass_node(cert_ctx["user_id"], cert_ctx["camp_id"], 2, "d2-review")
    _add_rubric(cert_ctx["course_version_id"], "d1-lab")  # ...this required rubric node never passed

    with pytest.raises(CertificateError, match="必需评测未全部通过"):
        issue_certificate(cert_ctx["enrollment_id"])


def test_issue_blocked_without_mentor_approval(cert_ctx):
    from services.application.certificates import CertificateError, issue_certificate

    _mark_verified(cert_ctx["user_id"])
    _pass_node(cert_ctx["user_id"], cert_ctx["camp_id"], 1, "d1-lab")
    _pass_node(cert_ctx["user_id"], cert_ctx["camp_id"], 2, "d2-lab")

    with pytest.raises(CertificateError, match="导师复核"):
        issue_certificate(cert_ctx["enrollment_id"], mentor_approved=False)


def test_issue_verify_and_revoke_round_trip(cert_ctx):
    from services.application.certificates import issue_certificate, revoke_certificate, verify_certificate
    from services.storage import get_store
    from services.shared.config import S3_BUCKET_ARTIFACTS

    _mark_verified(cert_ctx["user_id"])
    _add_rubric(cert_ctx["course_version_id"], "d1-lab")
    _pass_node(cert_ctx["user_id"], cert_ctx["camp_id"], 1, "d1-lab")
    _pass_node(cert_ctx["user_id"], cert_ctx["camp_id"], 2, "d2-lab")

    issued = issue_certificate(cert_ctx["enrollment_id"], actor_id=cert_ctx["user_id"])
    cert_id = issued["cert_id"]

    assert issued["qr_payload"]["cert_id"] == cert_id
    assert issued["qr_payload"]["verify_url"] == f"/verify/{cert_id}"
    assert issued["completion_snapshot"]["identity_verified"] is True
    assert issued["completion_snapshot"]["rubric_gate"]["ok"] is True

    # Artifact fallback: reportlab isn't a required dependency, so this must
    # be a JSON manifest — but *some* object must land in fde-artifacts.
    assert issued["pdf_object_key"]
    manifest_bytes = get_store().get_bytes(S3_BUCKET_ARTIFACTS, issued["pdf_object_key"])
    if issued["pdf_object_key"].endswith(".json"):
        manifest = json.loads(manifest_bytes)
        assert manifest["cert_id"] == cert_id

    verified = verify_certificate(cert_id)
    assert verified["valid"] is True
    assert verified["status"] == "issued"

    revoked = revoke_certificate(cert_id, "测试撤销", actor_id=cert_ctx["user_id"])
    assert revoked["status"] == "revoked"

    after_revoke = verify_certificate(cert_id)
    assert after_revoke["valid"] is False
    assert after_revoke["status"] == "revoked"
    assert after_revoke["revoke_reason"] == "测试撤销"


def test_verify_unknown_certificate_returns_invalid():
    from services.application.certificates import verify_certificate

    result = verify_certificate(f"does-not-exist-{uuid4().hex[:8]}")
    assert result["valid"] is False


def test_revoke_unknown_certificate_raises():
    from services.application.certificates import CertificateError, revoke_certificate

    with pytest.raises(CertificateError):
        revoke_certificate(f"does-not-exist-{uuid4().hex[:8]}", "reason")


def test_prod_never_bypasses_identity_check_even_if_explicitly_allowed(cert_ctx, monkeypatch):
    import services.application.certificates as certs

    monkeypatch.setattr(certs, "FDE_ENV", "prod")
    _pass_node(cert_ctx["user_id"], cert_ctx["camp_id"], 1, "d1-lab")
    _pass_node(cert_ctx["user_id"], cert_ctx["camp_id"], 2, "d2-lab")

    with pytest.raises(certs.CertificateError, match="身份未认证"):
        certs.issue_certificate(cert_ctx["enrollment_id"], allow_unverified=True)


def test_issue_unknown_enrollment_raises():
    from services.application.certificates import CertificateError, issue_certificate

    with pytest.raises(CertificateError, match="enrollment not found"):
        issue_certificate(f"does-not-exist-{uuid4().hex[:8]}")
