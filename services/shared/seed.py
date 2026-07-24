"""Demo users / camps seed + curriculum YAML import."""

from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any

from services.shared.config import (
    AUTHOR_EMAIL,
    AUTHOR_PASSWORD,
    DEMO_EMAIL,
    DEMO_PASSWORD,
    LINGZHI_API_KEY,
    SEED_DEMO_USERS,
)
from services.shared.db import db_cursor


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000).hex()
    return f"pbkdf2${salt}${digest}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algo, salt, digest = encoded.split("$", 2)
    except ValueError:
        return False
    if algo not in ("pbkdf2", "pbkdf2_sha256"):
        return False
    check = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000).hex()
    return hmac.compare_digest(check, digest)


def seed_defaults() -> None:
    with db_cursor() as cur:
        cur.execute("SELECT id FROM camps WHERE id=?", ("camp-v03",))
        if not cur.fetchone():
            cur.execute(
                "INSERT INTO camps (id, name, version, invite_code, lingzhi_api_key, created_at) VALUES (?,?,?,?,?,?)",
                ("camp-v03", "FDE 0期 v0.3", "v0.3", "FDE-DEMO", LINGZHI_API_KEY or None, now_iso()),
            )
        if not SEED_DEMO_USERS:
            return
        for email, password, role, name in (
            (DEMO_EMAIL, DEMO_PASSWORD, "learner", "Demo Learner"),
            (AUTHOR_EMAIL, AUTHOR_PASSWORD, "author", "Demo Author"),
        ):
            cur.execute("SELECT id FROM users WHERE email=?", (email,))
            row = cur.fetchone()
            if not row:
                uid = str(uuid.uuid4())
                cur.execute(
                    "INSERT INTO users (id, email, password_hash, display_name, role, created_at) VALUES (?,?,?,?,?,?)",
                    (uid, email, hash_password(password), name, role, now_iso()),
                )
                cur.execute(
                    "INSERT INTO enrollments (user_id, camp_id, status, created_at) VALUES (?,?,?,?) ON CONFLICT DO NOTHING",
                    (uid, "camp-v03", "active", now_iso()),
                )
            else:
                uid = row["id"] if isinstance(row, dict) else row[0]
                cur.execute("SELECT 1 FROM enrollments WHERE user_id=? AND camp_id=?", (uid, "camp-v03"))
                if not cur.fetchone():
                    cur.execute(
                        "INSERT INTO enrollments (user_id, camp_id, status, created_at) VALUES (?,?,?,?) ON CONFLICT DO NOTHING",
                        (uid, "camp-v03", "active", now_iso()),
                    )


def _day_yaml_path(day: int):
    from services.shared.config import CONTRACTS_DIR

    path = CONTRACTS_DIR / f"day-{day:02d}-curriculum.yaml"
    if not path.exists():
        alt = CONTRACTS_DIR / f"day-{day:02d}-k8s-curriculum.yaml"
        if alt.exists():
            return alt
    return path if path.exists() else None


def _upsert_days(cv_id: str) -> int:
    import yaml

    count = 0
    for day in range(1, 14):
        path = _day_yaml_path(day)
        if not path:
            continue
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        payload = json.dumps(data, ensure_ascii=False)
        title = str(data.get("title") or f"Day {day}")
        project = data.get("project")
        with db_cursor() as cur:
            cur.execute(
                "SELECT id FROM day_packages WHERE course_version_id=? AND day=?",
                (cv_id, day),
            )
            row = cur.fetchone()
            if row:
                cur.execute(
                    """
                    UPDATE day_packages
                    SET title=?, project=?, package_json=?::jsonb
                    WHERE course_version_id=? AND day=?
                    """,
                    (title, project, payload, cv_id, day),
                )
            else:
                cur.execute(
                    """
                    INSERT INTO day_packages (id, course_version_id, day, title, project, package_json, created_at)
                    VALUES (?,?,?,?,?,?::jsonb,?)
                    """,
                    (str(uuid.uuid4()), cv_id, day, title, project, payload, now_iso()),
                )
        count += 1
    try:
        from services.application.curriculum_projection import project_course_version

        project_course_version(cv_id)
    except Exception:
        pass
    return count


def seed_course_version_from_yaml(camp_id: str = "camp-v03", version_tag: str = "721-v1") -> dict[str, Any]:
    """Create or refresh a published course_version from curriculum YAML (Day1-13)."""
    with db_cursor() as cur:
        cur.execute(
            "SELECT id FROM course_versions WHERE camp_id=? AND version_tag=?",
            (camp_id, version_tag),
        )
        existing = cur.fetchone()
        if existing:
            cv_id = existing["id"]
            days = _upsert_days(cv_id)
            return {"id": cv_id, "created": False, "upserted": True, "days": days}

        cv_id = str(uuid.uuid4())
        cur.execute(
            """
            INSERT INTO course_versions (id, camp_id, version_tag, status, title, source, published_at, created_at)
            VALUES (?,?,?,?,?,?,NOW(),?)
            """,
            (cv_id, camp_id, version_tag, "published", "FDE 两周课 721", "curriculum-yaml", now_iso()),
        )
    days = _upsert_days(cv_id)
    return {"id": cv_id, "created": True, "days": days}
