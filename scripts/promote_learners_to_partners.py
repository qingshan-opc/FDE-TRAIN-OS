#!/usr/bin/env python3
"""Promote all learner users to partner (机构) accounts — idempotent.

For each users.role='learner' without an org_accounts row:
  1) create a personal organization
  2) insert org_accounts (same email + password_hash)
  3) set users.role='partner'
  4) seed default commission tier + primary invite code
  5) optionally copy wx_mp_openid onto org receiver fields

Usage (inside API container or with DATABASE_URL):
  python scripts/promote_learners_to_partners.py --dry-run
  python scripts/promote_learners_to_partners.py --apply
"""

from __future__ import annotations

import argparse
import re
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from services.shared.db import db_cursor  # noqa: E402
from services.shared.seed import now_iso  # noqa: E402

CODE_RE = re.compile(r"^[A-Za-z0-9_-]{4,32}$")


def _org_id_for(user_id: str) -> str:
    compact = re.sub(r"[^a-zA-Z0-9]", "", user_id).lower()[:16]
    return f"org-u-{compact or uuid.uuid4().hex[:12]}"


def _invite_code_for(user_id: str) -> str:
    compact = re.sub(r"[^a-zA-Z0-9]", "", user_id).upper()
    code = f"P{compact[:10]}"
    if not CODE_RE.match(code):
        code = f"P{uuid.uuid4().hex[:10].upper()}"
    return code


def _org_name(display_name: str | None, email: str) -> str:
    base = (display_name or "").strip() or email.split("@")[0]
    base = base[:40]
    return f"{base}的机构"


def candidates(cur) -> list[dict]:
    cur.execute(
        """
        SELECT u.id, u.email, u.display_name, u.password_hash, u.wx_mp_openid, u.wx_nickname
        FROM users u
        WHERE u.role = 'learner'
          AND u.email IS NOT NULL
          AND length(trim(u.email)) > 0
          AND NOT EXISTS (
            SELECT 1 FROM org_accounts oa WHERE lower(oa.email) = lower(u.email)
          )
        ORDER BY u.created_at NULLS LAST, u.email
        """
    )
    return [dict(r) for r in cur.fetchall()]


def ensure_unique_invite(cur, preferred: str) -> str:
    code = preferred
    for _ in range(8):
        cur.execute("SELECT 1 FROM invite_codes WHERE upper(code)=upper(?)", (code,))
        if not cur.fetchone():
            return code
        code = f"P{uuid.uuid4().hex[:10].upper()}"
    raise RuntimeError("unable to allocate unique invite code")


def promote_one(cur, user: dict, *, apply: bool) -> dict:
    email = str(user["email"]).strip()
    uid = str(user["id"])
    oid = _org_id_for(uid)
    # avoid org id collision
    cur.execute("SELECT 1 FROM organizations WHERE id=?", (oid,))
    if cur.fetchone():
        oid = f"org-u-{uuid.uuid4().hex[:12]}"

    name = _org_name(user.get("display_name"), email)
    openid = (user.get("wx_mp_openid") or "").strip() or None
    nickname = (user.get("wx_nickname") or "").strip() or None
    pw = user.get("password_hash")
    if not pw:
        raise RuntimeError(f"missing password_hash for {email}")

    invite = ensure_unique_invite(cur, _invite_code_for(uid)) if apply else _invite_code_for(uid)
    info = {
        "user_id": uid,
        "email": email,
        "org_id": oid,
        "org_name": name,
        "invite_code": invite,
        "wx_bound": bool(openid),
    }
    if not apply:
        return info

    ts = now_iso()
    cur.execute(
        """
        INSERT INTO organizations (
          id, name, status, contact_name, contact_email,
          wx_receiver_type, wx_receiver_account, wx_receiver_name,
          created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?)
        """,
        (
            oid,
            name,
            "active",
            user.get("display_name") or email,
            email,
            "PERSONAL_OPENID" if openid else None,
            openid,
            nickname or (user.get("display_name") if openid else None),
            ts,
            ts,
        ),
    )
    oa_id = f"oa-{uuid.uuid4().hex[:12]}"
    cur.execute(
        """
        INSERT INTO org_accounts (id, org_id, email, password_hash, display_name, status, created_at)
        VALUES (?,?,?,?,?,?,?)
        """,
        (
            oa_id,
            oid,
            email,
            pw,
            user.get("display_name") or email,
            "active",
            ts,
        ),
    )
    cur.execute("UPDATE users SET role='partner' WHERE id=?", (uid,))
    cur.execute(
        """
        INSERT INTO commission_tiers (id, org_id, min_paid_users, rate_bps, created_at)
        VALUES (?,?,?,?,?)
        """,
        (f"ct-{uuid.uuid4().hex[:12]}", oid, 0, 1000, ts),
    )
    cur.execute(
        """
        INSERT INTO invite_codes (
          id, org_id, code, offering_id, status, max_uses, used_count, expires_at, created_by, created_at
        ) VALUES (?,?,?,?,?,?,0,?,?,?)
        """,
        (f"ic-{uuid.uuid4().hex[:12]}", oid, invite, None, "active", None, None, uid, ts),
    )
    return info


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="print plan only (default if --apply omitted)")
    ap.add_argument("--apply", action="store_true", help="write changes")
    ap.add_argument("--limit", type=int, default=0, help="optional max conversions")
    args = ap.parse_args()
    apply = bool(args.apply)
    if not apply:
        args.dry_run = True

    with db_cursor() as cur:
        rows = candidates(cur)
        if args.limit and args.limit > 0:
            rows = rows[: args.limit]
        print(f"mode={'APPLY' if apply else 'DRY-RUN'} candidates={len(rows)}")
        done = []
        for u in rows:
            info = promote_one(cur, u, apply=apply)
            done.append(info)
            print(
                f"{'OK' if apply else 'PLAN'} email={info['email']} org={info['org_id']} "
                f"invite={info['invite_code']} wx={info['wx_bound']}"
            )
        if apply:
            cur.execute("SELECT role, count(*) AS n FROM users GROUP BY role ORDER BY n DESC")
            print("roles_after:", [dict(r) for r in cur.fetchall()])
            cur.execute("SELECT count(*) AS n FROM org_accounts")
            print("org_accounts_after:", dict(cur.fetchone())["n"])
            cur.execute("SELECT count(*) AS n FROM organizations")
            print("orgs_after:", dict(cur.fetchone())["n"])
        print(f"done count={len(done)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
