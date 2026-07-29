"""PostgreSQL migration runner — sole schema authority for prod/dev PG."""

from __future__ import annotations

import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from services.shared.config import DATABASE_URL, FDE_ENV, require_database_url  # noqa: E402


def run_migrations(database_url: str | None = None) -> list[str]:
    require_database_url(database_url or DATABASE_URL)
    url = database_url or DATABASE_URL
    import psycopg

    migrations_dir = _ROOT / "migrations"
    files = sorted(migrations_dir.glob("*.sql"))
    applied: list[str] = []
    with psycopg.connect(url) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
              version TEXT PRIMARY KEY,
              applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        conn.commit()
        for path in files:
            version = path.stem
            row = conn.execute(
                "SELECT 1 FROM schema_migrations WHERE version=%s", (version,)
            ).fetchone()
            if row:
                continue
            sql = path.read_text(encoding="utf-8")
            with conn.transaction():
                conn.execute(sql)
                conn.execute(
                    "INSERT INTO schema_migrations (version) VALUES (%s) ON CONFLICT DO NOTHING",
                    (version,),
                )
            applied.append(version)
    return applied


def main() -> None:
    require_database_url()
    applied = run_migrations()
    print({"env": FDE_ENV, "applied": applied, "ok": True})


if __name__ == "__main__":
    main()
