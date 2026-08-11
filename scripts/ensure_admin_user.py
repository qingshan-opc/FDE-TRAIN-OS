#!/usr/bin/env python3
"""Upsert a super-admin role user (idempotent).

Usage:
  DATABASE_URL=... python scripts/ensure_admin_user.py \\
    --email admin@818cloud.com --password 'FdeAdmin#20260804'
"""

from __future__ import annotations

import argparse
import os
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from services.shared.db import db_cursor  # noqa: E402
from services.shared.seed import hash_password, now_iso  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--email", default=os.getenv("FDE_ADMIN_EMAIL", "admin@818cloud.com"))
    ap.add_argument("--password", default=os.getenv("FDE_ADMIN_PASSWORD", "FdeAdmin#20260804"))
    ap.add_argument("--name", default="超级管理员")
    args = ap.parse_args()
    email = args.email.strip().lower()
    if not email or not args.password:
        print("email/password required", file=sys.stderr)
        return 2
    with db_cursor() as cur:
        cur.execute("SELECT id, role FROM users WHERE email=?", (email,))
        row = cur.fetchone()
        if row:
            uid = row["id"]
            cur.execute(
                "UPDATE users SET role='admin', display_name=?, password_hash=? WHERE id=?",
                (args.name, hash_password(args.password), uid),
            )
            print(f"updated admin user {email} id={uid}")
        else:
            uid = str(uuid.uuid4())
            cur.execute(
                "INSERT INTO users (id, email, password_hash, display_name, role, created_at) VALUES (?,?,?,?,?,?)",
                (uid, email, hash_password(args.password), args.name, "admin", now_iso()),
            )
            print(f"created admin user {email} id={uid}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
