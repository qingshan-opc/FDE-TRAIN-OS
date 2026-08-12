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
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    AUTHOR_EMAIL,
    AUTHOR_PASSWORD,
    CURRICULUM_VERSION_TAG,
    DEFAULT_CAMP_ID,
    DEMO_EMAIL,
    DEMO_PASSWORD,
    FINANCE_EMAIL,
    FINANCE_PASSWORD,
    LEARNER_EMAIL,
    LEARNER_PASSWORD,
    LINGZHI_API_KEY,
    PARTNER_DEMO_EMAIL,
    PARTNER_DEMO_PASSWORD,
    PASSWORD_PBKDF2_ITERATIONS,
    SEED_DEMO_USERS,
)
from services.shared.db import db_cursor


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), PASSWORD_PBKDF2_ITERATIONS).hex()
    return f"pbkdf2${salt}${digest}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algo, salt, digest = encoded.split("$", 2)
    except ValueError:
        return False
    if algo not in ("pbkdf2", "pbkdf2_sha256"):
        return False
    check = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), PASSWORD_PBKDF2_ITERATIONS).hex()
    return hmac.compare_digest(check, digest)


def seed_defaults() -> None:
    with db_cursor() as cur:
        cur.execute("SELECT id FROM camps WHERE id=?", (DEFAULT_CAMP_ID,))
        if not cur.fetchone():
            cur.execute(
                "INSERT INTO camps (id, name, version, invite_code, lingzhi_api_key, created_at) VALUES (?,?,?,?,?,?)",
                (DEFAULT_CAMP_ID, "FDE 0期 v0.3", "v0.3", "FDE-DEMO", LINGZHI_API_KEY or None, now_iso()),
            )
        if not SEED_DEMO_USERS:
            return
        for email, password, role, name in (
            (LEARNER_EMAIL, LEARNER_PASSWORD, "learner", "学习账号"),
            (DEMO_EMAIL, DEMO_PASSWORD, "learner", "Demo Learner"),
            (AUTHOR_EMAIL, AUTHOR_PASSWORD, "author", "Demo Author"),
            (FINANCE_EMAIL, FINANCE_PASSWORD, "finance", "财务人员"),
            (ADMIN_EMAIL, ADMIN_PASSWORD, "admin", "超级管理员"),
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
                    (uid, DEFAULT_CAMP_ID, "active", now_iso()),
                )
            else:
                uid = row["id"] if isinstance(row, dict) else row[0]
                cur.execute("SELECT 1 FROM enrollments WHERE user_id=? AND camp_id=?", (uid, DEFAULT_CAMP_ID))
                if not cur.fetchone():
                    cur.execute(
                        "INSERT INTO enrollments (user_id, camp_id, status, created_at) VALUES (?,?,?,?) ON CONFLICT DO NOTHING",
                        (uid, DEFAULT_CAMP_ID, "active", now_iso()),
                    )
        _seed_partner_demo(cur)


def _seed_partner_demo(cur) -> None:
    """Demo org + partner account + invite code for channel testing."""
    cur.execute("SELECT id FROM organizations WHERE id=?", ("org-demo",))
    if not cur.fetchone():
        cur.execute(
            "INSERT INTO organizations (id, name, status, contact_name, created_at, updated_at) VALUES (?,?,?,?,?,?)",
            ("org-demo", "演示合作机构", "active", "张老师", now_iso(), now_iso()),
        )
        cur.execute(
            """
            INSERT INTO commission_tiers (id, org_id, min_paid_users, rate_bps, created_at)
            VALUES (?,?,?,?,?)
            ON CONFLICT DO NOTHING
            """,
            ("ct-demo-0", "org-demo", 0, 3000, now_iso()),
        )
        cur.execute(
            """
            INSERT INTO commission_tiers (id, org_id, min_paid_users, rate_bps, created_at)
            VALUES (?,?,?,?,?)
            ON CONFLICT DO NOTHING
            """,
            ("ct-demo-10", "org-demo", 10, 3000, now_iso()),
        )
    cur.execute("SELECT id FROM invite_codes WHERE code=?", ("PARTNER-DEMO",))
    if not cur.fetchone():
        cur.execute(
            """
            INSERT INTO invite_codes (id, org_id, code, status, used_count, created_at)
            VALUES (?,?,?,?,0,?)
            """,
            ("ic-partner-demo", "org-demo", "PARTNER-DEMO", "active", now_iso()),
        )
    cur.execute("SELECT id FROM users WHERE email=?", (PARTNER_DEMO_EMAIL,))
    row = cur.fetchone()
    if not row:
        uid = str(uuid.uuid4())
        cur.execute(
            "INSERT INTO users (id, email, password_hash, display_name, role, created_at) VALUES (?,?,?,?,?,?)",
            (uid, PARTNER_DEMO_EMAIL, hash_password(PARTNER_DEMO_PASSWORD), "演示机构管理员", "partner", now_iso()),
        )
    else:
        uid = row["id"] if isinstance(row, dict) else row[0]
    cur.execute("SELECT id FROM org_accounts WHERE email=?", (PARTNER_DEMO_EMAIL,))
    if not cur.fetchone():
        cur.execute(
            """
            INSERT INTO org_accounts (id, org_id, email, password_hash, display_name, status, created_at)
            VALUES (?,?,?,?,?,?,?)
            """,
            (
                f"oa-{uuid.uuid4().hex[:12]}",
                "org-demo",
                PARTNER_DEMO_EMAIL,
                hash_password(PARTNER_DEMO_PASSWORD),
                "演示机构管理员",
                "active",
                now_iso(),
            ),
        )


def _day_yaml_path(day: int):
    from services.shared.config import CONTRACTS_DIR

    path = CONTRACTS_DIR / f"day-{day:02d}-curriculum.yaml"
    if not path.exists():
        alt = CONTRACTS_DIR / f"day-{day:02d}-k8s-curriculum.yaml"
        if alt.exists():
            return alt
    return path if path.exists() else None


def _iter_seed_days() -> list[int]:
    """Discover day-NN-curriculum.yaml under CONTRACTS_DIR (not a hard-coded 1..13)."""
    from services.shared.config import CONTRACTS_DIR

    days: set[int] = set()
    if CONTRACTS_DIR.is_dir():
        for path in CONTRACTS_DIR.glob("day-*-curriculum.yaml"):
            try:
                days.add(int(path.name.split("-")[1]))
            except (IndexError, ValueError):
                continue
    # Keep a small fallback for fresh envs that only ship early days.
    if not days:
        days = set(range(1, 14))
    return sorted(days)


def _upsert_days(cv_id: str, *, overwrite: bool | None = None) -> int:
    """Seed day_packages from curriculum YAML.

    Default is **insert-missing only**. Blind UPDATE on every bootstrap was
    wiping author/bootcamp syncs (e.g. Day1 QRAE 6-capsule pack) back to a
    stale contracts/examples snapshot. Set FDE_SEED_OVERWRITE_PACKAGES=1 to
    force refresh from YAML (intentional curriculum cutover).
    """
    import os

    import yaml

    if overwrite is None:
        overwrite = os.getenv("FDE_SEED_OVERWRITE_PACKAGES", "0") == "1"

    count = 0
    for day in _iter_seed_days():
        path = _day_yaml_path(day)
        if not path:
            continue
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        if not (data.get("nodes") or data.get("learn")):
            continue
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
                if not overwrite:
                    continue
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


def seed_course_version_from_yaml(
    camp_id: str = DEFAULT_CAMP_ID, version_tag: str = CURRICULUM_VERSION_TAG
) -> dict[str, Any]:
    """Create or refresh a published course_version from curriculum YAML (Day1-10)."""
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
            (cv_id, camp_id, version_tag, "published", f"FDE 训练营 · AI 角色周 + 全栈理论（{CURRICULUM_VERSION_TAG}）", "curriculum-yaml", now_iso()),
        )
    days = _upsert_days(cv_id)
    return {"id": cv_id, "created": True, "days": days}
