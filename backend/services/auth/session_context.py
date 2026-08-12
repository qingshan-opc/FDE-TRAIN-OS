"""Server-driven session portals — UI entries decided only on the backend."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

from services.shared import AuthUser, db_cursor

LEARN_ROLES = frozenset({"learner", "partner", "author", "admin"})
AUTHOR_PORTAL_ROLES = frozenset({"author", "admin"})
FINANCE_PORTAL_ROLES = frozenset({"finance", "author", "admin"})


def user_can_learn(role: str | None) -> bool:
    return (role or "") in LEARN_ROLES


def list_partner_orgs(user_id: str) -> list[dict[str, str]]:
    """Orgs linked via active org_accounts (email join). List-shaped for multi-org later."""
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT o.id, o.name
            FROM org_accounts oa
            JOIN users u ON LOWER(u.email) = LOWER(oa.email)
            JOIN organizations o ON o.id = oa.org_id
            WHERE u.id=? AND oa.status='active'
            ORDER BY oa.created_at ASC NULLS LAST, o.name ASC
            """,
            (user_id,),
        )
        rows = cur.fetchall() or []
    out: list[dict[str, str]] = []
    for r in rows:
        d = dict(r)
        oid = str(d.get("id") or "").strip()
        if not oid:
            continue
        out.append({"id": oid, "name": str(d.get("name") or "机构后台").strip() or "机构后台"})
    return out


def build_session_context(user: AuthUser) -> dict[str, Any]:
    """Return default_home + portals for /me and login payloads."""
    portals: list[dict[str, Any]] = []
    role = user.role or ""

    if role == "finance":
        portals.append(
            {
                "id": "finance",
                "label": "财务大屏",
                "path": "/author/finance",
                "kind": "finance",
            }
        )
        return {"default_home": "/author/finance", "portals": portals}

    if user_can_learn(role):
        portals.append(
            {
                "id": "learner",
                "label": "学习平台",
                "path": "/app/courses",
                "kind": "learner",
            }
        )

    if role in AUTHOR_PORTAL_ROLES:
        portals.append(
            {
                "id": "author",
                "label": "教研台",
                "path": "/author",
                "kind": "author",
            }
        )

    orgs = list_partner_orgs(user.id)
    multi = len(orgs) > 1
    for org in orgs:
        path = "/partner"
        if multi:
            path = f"/partner?org_id={quote(org['id'], safe='')}"
        portals.append(
            {
                "id": f"partner:{org['id']}",
                "label": org["name"] if multi else "机构后台",
                "path": path,
                "kind": "partner",
                "org_id": org["id"],
            }
        )

    default_home = "/app/courses"
    if role in AUTHOR_PORTAL_ROLES:
        default_home = "/author"
    elif role == "partner":
        default_home = "/app/courses"

    paths = {p["path"].split("?")[0] for p in portals}
    if portals and default_home.split("?")[0] not in paths:
        default_home = str(portals[0]["path"])

    return {"default_home": default_home, "portals": portals}


def attach_session_context(payload: dict[str, Any], user: AuthUser) -> dict[str, Any]:
    ctx = build_session_context(user)
    payload["default_home"] = ctx["default_home"]
    payload["portals"] = ctx["portals"]
    return payload
