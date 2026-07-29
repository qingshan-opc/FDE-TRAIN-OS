"""FDE shared runtime: config, DB, auth helpers, logging, artifacts."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import jwt as pyjwt
except ImportError:  # pragma: no cover
    pyjwt = None  # type: ignore

from services.shared.config import (  # noqa: F401
    AGENT_MODE,
    ALLOW_DEV_HEADERS,
    ANYCODE_API_TOKEN,
    ANYCODE_COACH_SKILL_ID,
    ANYCODE_DASHBOARD_URL,
    ANYCODE_SSE_TIMEOUT_SEC,
    ARTIFACT_ROOT,
    AUTHOR_EMAIL,
    AUTHOR_PASSWORD,
    CONTRACTS_DIR,
    CONTRACTS_UPLOAD_DIR,
    CORS_ORIGINS,
    DATA_DIR,
    DATABASE_URL,
    DEMO_EMAIL,
    DEMO_PASSWORD,
    DOCUMENT_MAX_BYTES,
    FDE_ENV,
    FDE_INTERNAL_BASE,
    JWT_SECRET,
    JWT_TTL_SEC,
    LINGZHI_API_KEY,
    LINGZHI_BASE_URL,
    LINGZHI_CLIENT_TOKEN,
    LINGZHI_SOURCE_ID,
    REFRESH_TTL_SEC,
    ROOT,
    S3_BUCKET_ARTIFACTS,
    S3_BUCKET_DOCUMENTS,
    S3_BUCKET_WORKSPACES,
    S3_ENDPOINT,
    SEED_DEMO_USERS,
    TEMP_WORKSPACE_ROOT,
    WORKSPACE_MAX_BYTES,
    WORKSPACE_ROOT,
    ensure_dirs,
    require_database_url,
)
from services.shared.db import close_pool, db_conn, db_cursor, get_pool, healthcheck  # noqa: F401
from services.shared.seed import (  # noqa: F401
    hash_password as _hash_password,
    seed_course_version_from_yaml,
    seed_defaults,
    verify_password,
)

# backward-compat aliases used by older services
DB_PATH = DATA_DIR / "fde.db"  # unused at runtime; kept for import safety


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def use_postgres() -> bool:
    """Always true for application runtime."""
    return True


def camp_api_key(camp_id: str | None = None) -> str:
    if camp_id:
        try:
            with db_cursor() as cur:
                cur.execute("SELECT lingzhi_api_key FROM camps WHERE id=?", (camp_id,))
                row = cur.fetchone()
                if row and row.get("lingzhi_api_key"):
                    return str(row["lingzhi_api_key"])
        except Exception:
            pass
    raw = __import__("os").getenv("LINGZHI_CAMP_KEYS", "")
    if camp_id and raw:
        for part in raw.split(","):
            part = part.strip()
            if not part or ":" not in part:
                continue
            cid, key = part.split(":", 1)
            if cid.strip() == camp_id:
                return key.strip()
    return LINGZHI_API_KEY


def _pg_upsert_enrollment(cur, user_id: str, camp_id: str) -> None:
    cur.execute(
        """
        INSERT INTO enrollments (user_id, camp_id, status, created_at)
        VALUES (%s,%s,'active',NOW())
        ON CONFLICT (user_id, camp_id) DO NOTHING
        """,
        (user_id, camp_id),
    )


def mask_secret(value: str | None) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return "***"
    return value[:4] + "***" + value[-4:]


def workspace_path(camp_id: str, learner_id: str) -> Path:
    """Legacy local path helper — prefer temp_workspace + MinIO snapshots in new code."""
    ensure_dirs()
    safe_camp = re.sub(r"[^a-zA-Z0-9_-]", "_", camp_id)[:64]
    safe_learner = re.sub(r"[^a-zA-Z0-9_-]", "_", learner_id)[:64]
    path = WORKSPACE_ROOT / safe_camp / safe_learner
    path.mkdir(parents=True, exist_ok=True)
    return path.resolve()


def resolve_safe(root: Path, relative: str) -> Path:
    target = (root / relative).resolve()
    if not str(target).startswith(str(root.resolve())):
        raise ValueError("path escapes workspace")
    return target


def workspace_size_bytes(root: Path) -> int:
    total = 0
    if not root.exists():
        return 0
    for p in root.rglob("*"):
        if p.is_file():
            total += p.stat().st_size
    return total


def setup_logging() -> None:
    level = __import__("os").getenv("FDE_LOG_LEVEL", "INFO")
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s request_id=%(request_id)s %(name)s %(message)s",
    )
    old_factory = logging.getLogRecordFactory()

    def record_factory(*args, **kwargs):
        record = old_factory(*args, **kwargs)
        if not hasattr(record, "request_id"):
            # Deferred import: `services.shared.middleware` imports from this
            # module at module load time, so importing it back here at
            # *module* scope would be circular — importing lazily inside the
            # record factory (called per log line, module already cached in
            # sys.modules by then) sidesteps that.
            try:
                from services.shared.middleware import request_id_var

                record.request_id = request_id_var.get()
            except Exception:
                record.request_id = "-"
        return record

    logging.setLogRecordFactory(record_factory)


log = logging.getLogger("fde")


def init_schema(conn: Any = None) -> None:
    """Run migrations + seed. No CREATE TABLE in application code beyond migrations.

    In prod, every app process calling this on boot is *not* allowed to silently
    run migrations/seed — that must go through a dedicated, explicit migration
    step. Set FDE_ALLOW_RUNTIME_MIGRATE=1 to opt back into the old (dev-style)
    behavior; otherwise this is a no-op with a warning. Non-prod keeps full
    behavior unchanged."""
    ensure_dirs()
    require_database_url()
    if FDE_ENV == "prod" and os.getenv("FDE_ALLOW_RUNTIME_MIGRATE", "0") != "1":
        log.warning(
            "FDE_ENV=prod: skipping runtime migrate/seed (set FDE_ALLOW_RUNTIME_MIGRATE=1 "
            "to explicitly allow migrate-on-boot). Apply migrations via the dedicated "
            "migration Job/step instead."
        )
    else:
        from services.migrations_runner.__main__ import run_migrations

        run_migrations()
        seed_defaults()
        try:
            seed_course_version_from_yaml()
        except Exception as exc:
            log.warning("course seed skipped: %s", exc)
        try:
            from services.shared.seed_domain_v2 import seed_domain_v2

            seed_domain_v2()
        except Exception as exc:
            log.warning("domain v2 seed skipped: %s", exc)
    try:
        from services.storage import get_store

        get_store().ensure_buckets()
    except Exception as exc:
        log.warning("minio bucket ensure skipped: %s", exc)


def connect_db():
    raise RuntimeError("SQLite connect_db() removed — use db_cursor()/db_conn()")


# ---------- Auth / JWT ----------

@dataclass
class AuthUser:
    id: str
    email: str
    role: str
    display_name: str | None = None
    camp_id: str | None = None


def create_access_token(user: AuthUser, camp_id: str | None = None) -> str:
    payload = {
        "sub": user.id,
        "email": user.email,
        "role": user.role,
        "camp_id": camp_id,
        "typ": "access",
        "exp": int(time.time()) + JWT_TTL_SEC,
        "iat": int(time.time()),
    }
    if pyjwt is None:
        raw = json.dumps(payload, separators=(",", ":"))
        sig = hmac.new(JWT_SECRET.encode(), raw.encode(), hashlib.sha256).hexdigest()
        return raw + "." + sig
    return pyjwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_access_token(token: str) -> dict[str, Any]:
    if pyjwt is None:
        raw, sig = token.rsplit(".", 1)
        expect = hmac.new(JWT_SECRET.encode(), raw.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expect, sig):
            raise ValueError("invalid token")
        payload = json.loads(raw)
        if int(payload.get("exp", 0)) < int(time.time()):
            raise ValueError("token expired")
        return payload
    return pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])


def create_refresh_session(user_id: str, camp_id: str | None = None, user_agent: str | None = None, ip: str | None = None) -> tuple[str, str]:
    """Return (session_id, refresh_token)."""
    session_id = str(uuid.uuid4())
    refresh = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(refresh.encode()).hexdigest()
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO sessions (id, user_id, refresh_token_hash, camp_id, expires_at, user_agent, ip)
            VALUES (?, ?, ?, ?, NOW() + ((?)::text || ' seconds')::interval, ?, ?)
            """,
            (session_id, user_id, token_hash, camp_id, str(REFRESH_TTL_SEC), user_agent, ip),
        )
    return session_id, refresh


def rotate_refresh_session(refresh_token: str) -> tuple[AuthUser, str, str, str | None]:
    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT s.*, u.email, u.role, u.display_name
            FROM sessions s JOIN users u ON u.id = s.user_id
            WHERE s.refresh_token_hash=? AND s.revoked_at IS NULL AND s.expires_at > NOW()
            """,
            (token_hash,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("invalid refresh")
        cur.execute("UPDATE sessions SET revoked_at=NOW() WHERE id=?", (row["id"],))
        user = AuthUser(id=row["user_id"], email=row["email"], role=row["role"], display_name=row.get("display_name"))
        camp_id = row.get("camp_id")
    sid, new_refresh = create_refresh_session(user.id, camp_id)
    return user, sid, new_refresh, camp_id


def revoke_refresh_session(refresh_token: str) -> None:
    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    with db_cursor() as cur:
        cur.execute("UPDATE sessions SET revoked_at=NOW() WHERE refresh_token_hash=?", (token_hash,))


def _auth_user_from_orm(user: Any) -> AuthUser:
    return AuthUser(
        id=user.id,
        email=user.email,
        role=user.role,
        display_name=user.display_name,
    )


def get_user_by_email(email: str) -> AuthUser | None:
    from services.db import session_scope
    from services.repositories import UserRepository

    with session_scope() as session:
        row = UserRepository(session).get_by_email(email)
        return _auth_user_from_orm(row) if row else None


def get_user_by_id(user_id: str) -> AuthUser | None:
    from services.db import session_scope
    from services.repositories import UserRepository

    with session_scope() as session:
        row = UserRepository(session).get(user_id)
        return _auth_user_from_orm(row) if row else None


def authenticate(email: str, password: str) -> AuthUser | None:
    from services.db import session_scope
    from services.repositories import UserRepository

    with session_scope() as session:
        row = UserRepository(session).get_by_email(email)
        if not row or not verify_password(password, row.password_hash):
            return None
        return _auth_user_from_orm(row)


def user_camps(user_id: str) -> list[dict[str, Any]]:
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT c.id, c.name, c.version, e.status
            FROM enrollments e JOIN camps c ON c.id = e.camp_id
            WHERE e.user_id=? AND e.status='active'
            """,
            (user_id,),
        )
        return [dict(r) for r in cur.fetchall()]


def user_enrolled(user_id: str, camp_id: str) -> bool:
    with db_cursor() as cur:
        cur.execute(
            "SELECT 1 FROM enrollments WHERE user_id=? AND camp_id=? AND status='active'",
            (user_id, camp_id),
        )
        return bool(cur.fetchone())


def write_audit(
    action: str,
    *,
    actor_id: str | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    camp_id: str | None = None,
    details: dict[str, Any] | None = None,
    ip: str | None = None,
) -> None:
    try:
        with db_cursor() as cur:
            cur.execute(
                """
                INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, camp_id, details_json, ip)
                VALUES (?, ?, ?, ?, ?, ?::jsonb, ?)
                """,
                (actor_id, action, resource_type, resource_id, camp_id, json.dumps(details or {}, ensure_ascii=False), ip),
            )
    except Exception as exc:
        log.warning("audit write failed: %s", exc)


def archive_workspace(camp_id: str, learner_id: str, job_id: str) -> str:
    """Archive to MinIO artifacts; fall back to local copy if MinIO unavailable."""
    src = workspace_path(camp_id, learner_id)
    try:
        from services.storage import archive_job_artifact, snapshot_workspace
        from services.shared.db import db_cursor as _cur

        snap = snapshot_workspace(camp_id, learner_id, src, job_id=job_id)
        with _cur() as cur:
            cur.execute(
                """
                INSERT INTO workspace_snapshots (id, camp_id, learner_id, parent_id, manifest_key, object_prefix, size_bytes, file_count, created_by_job_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                WHERE workspace_heads.snapshot_id IS DISTINCT FROM EXCLUDED.snapshot_id
                   OR TRUE
                """,
                (camp_id, learner_id, snap["id"]),
            )
        refs = archive_job_artifact(camp_id, learner_id, job_id, src)
        if refs:
            return refs[0].uri.rsplit("/", 1)[0]
        return f"s3://{S3_BUCKET_WORKSPACES}/{snap['object_prefix']}"
    except Exception as exc:
        log.warning("minio archive fallback local: %s", exc)
        import shutil

        ensure_dirs()
        dest = ARTIFACT_ROOT / camp_id / learner_id / job_id
        if dest.exists():
            shutil.rmtree(dest)
        if src.exists():
            shutil.copytree(src, dest)
        else:
            dest.mkdir(parents=True, exist_ok=True)
        return f"artifacts/{camp_id}/{learner_id}/{job_id}"
