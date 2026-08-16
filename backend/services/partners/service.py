"""Partner domain: orgs, invite codes, attributions, commission tiers."""

from __future__ import annotations

import re
from typing import Any
from uuid import uuid4

from services.shared import db_cursor, now_iso

MAX_RATE_BPS = 3000
CODE_RE = re.compile(r"^[A-Za-z0-9_-]{4,32}$")


def normalize_code(code: str) -> str:
    return (code or "").strip().upper()


def resolve_invite_code(code: str) -> dict[str, Any] | None:
    c = normalize_code(code)
    if not c:
        return None
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT ic.*, o.status AS org_status, o.name AS org_name
            FROM invite_codes ic
            JOIN organizations o ON o.id = ic.org_id
            WHERE UPPER(ic.code)=? AND ic.status='active' AND o.status='active'
            """,
            (c,),
        )
        row = cur.fetchone()
        if not row:
            cur.execute(
                "SELECT id, name, version, invite_code FROM camps WHERE UPPER(invite_code)=?",
                (c,),
            )
            camp = cur.fetchone()
            if camp:
                camp = dict(camp)
                cur.execute("SELECT id FROM organizations WHERE id='org-platform'")
                if cur.fetchone():
                    return {
                        "id": "legacy-camp",
                        "org_id": "org-platform",
                        "code": c,
                        "offering_id": None,
                        "camp_id": camp["id"],
                        "legacy": True,
                    }
            return None
        ic = dict(row)
        if ic.get("expires_at"):
            from datetime import datetime, timezone

            exp = ic["expires_at"]
            if hasattr(exp, "timestamp") and exp.timestamp() < datetime.now(timezone.utc).timestamp():
                return None
        max_uses = ic.get("max_uses")
        if max_uses is not None and int(ic.get("used_count") or 0) >= int(max_uses):
            return None
        return ic


def get_user_attribution(user_id: str) -> dict[str, Any] | None:
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT ua.*, o.name AS org_name, ic.code AS invite_code
            FROM user_attributions ua
            JOIN organizations o ON o.id = ua.org_id
            LEFT JOIN invite_codes ic ON ic.id = ua.invite_code_id
            WHERE ua.user_id=?
            """,
            (user_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def bind_invite_code(user_id: str, code: str) -> dict[str, Any]:
    existing = get_user_attribution(user_id)
    if existing:
        raise ValueError("已绑定渠道，不可更改")
    ic = resolve_invite_code(code)
    if not ic:
        raise ValueError("邀请码无效或已失效")
    org_id = ic["org_id"]
    invite_code_id = None if ic.get("legacy") else ic.get("id")
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO user_attributions (user_id, org_id, invite_code_id, bound_at)
            VALUES (?,?,?,?)
            """,
            (user_id, org_id, invite_code_id, now_iso()),
        )
        if invite_code_id:
            cur.execute(
                "UPDATE invite_codes SET used_count = used_count + 1 WHERE id=?",
                (invite_code_id,),
            )
    return get_user_attribution(user_id) or {"user_id": user_id, "org_id": org_id}


def org_paid_user_count(org_id: str, before_order_id: str | None = None) -> int:
    """Distinct paying users for org before current order (for tier matching)."""
    with db_cursor() as cur:
        if before_order_id:
            cur.execute(
                """
                SELECT COUNT(DISTINCT po.user_id) AS c
                FROM payment_orders po
                WHERE po.org_id=? AND po.status='paid' AND po.id <> ?
                """,
                (org_id, before_order_id),
            )
        else:
            cur.execute(
                """
                SELECT COUNT(DISTINCT po.user_id) AS c
                FROM payment_orders po
                WHERE po.org_id=? AND po.status='paid'
                """,
                (org_id,),
            )
        row = cur.fetchone()
        return int(row["c"] if row else 0)


def match_commission_rate_bps(org_id: str, paid_users_before: int) -> int:
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT rate_bps FROM commission_tiers
            WHERE org_id=? AND min_paid_users <= ?
            ORDER BY min_paid_users DESC
            LIMIT 1
            """,
            (org_id, paid_users_before),
        )
        row = cur.fetchone()
        return int(row["rate_bps"]) if row else 3000


def validate_tier_rate(rate_bps: int) -> None:
    if rate_bps < 0 or rate_bps > MAX_RATE_BPS:
        raise ValueError(f"分账比例须在 0–{MAX_RATE_BPS / 100:.0f}% 之间")


def list_organizations() -> list[dict[str, Any]]:
    with db_cursor() as cur:
        cur.execute("SELECT * FROM organizations ORDER BY created_at DESC")
        return [dict(r) for r in cur.fetchall()]


def get_organization(org_id: str) -> dict[str, Any] | None:
    with db_cursor() as cur:
        cur.execute("SELECT * FROM organizations WHERE id=?", (org_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def create_organization(data: dict[str, Any]) -> dict[str, Any]:
    oid = data.get("id") or f"org-{uuid4().hex[:12]}"
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO organizations (id, name, status, contact_name, contact_email,
              wx_receiver_type, wx_receiver_account, wx_receiver_name, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)
            """,
            (
                oid,
                data["name"],
                data.get("status") or "active",
                data.get("contact_name"),
                data.get("contact_email"),
                data.get("wx_receiver_type"),
                data.get("wx_receiver_account"),
                data.get("wx_receiver_name"),
                now_iso(),
                now_iso(),
            ),
        )
    return get_organization(oid) or {}


def update_organization(org_id: str, data: dict[str, Any]) -> dict[str, Any]:
    fields = []
    values: list[Any] = []
    for key in (
        "name",
        "status",
        "contact_name",
        "contact_email",
        "wx_receiver_type",
        "wx_receiver_account",
        "wx_receiver_name",
    ):
        if key in data:
            fields.append(f"{key}=?")
            values.append(data[key])
    if not fields:
        return get_organization(org_id) or {}
    fields.append("updated_at=?")
    values.append(now_iso())
    values.append(org_id)
    with db_cursor() as cur:
        cur.execute(f"UPDATE organizations SET {', '.join(fields)} WHERE id=?", values)
    return get_organization(org_id) or {}


def create_invite_code(org_id: str, code: str, created_by: str | None, **kwargs: Any) -> dict[str, Any]:
    c = normalize_code(code)
    if not CODE_RE.match(c):
        raise ValueError("邀请码格式无效（4–32 位字母数字/_/-）")
    iid = f"ic-{uuid4().hex[:12]}"
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO invite_codes (id, org_id, code, offering_id, status, max_uses, used_count, expires_at, created_by, created_at)
            VALUES (?,?,?,?,?,?,0,?,?,?)
            """,
            (
                iid,
                org_id,
                c,
                kwargs.get("offering_id"),
                kwargs.get("status") or "active",
                kwargs.get("max_uses"),
                kwargs.get("expires_at"),
                created_by,
                now_iso(),
            ),
        )
        cur.execute("SELECT * FROM invite_codes WHERE id=?", (iid,))
        row = cur.fetchone()
        return dict(row) if row else {}


def list_invite_codes(org_id: str | None = None) -> list[dict[str, Any]]:
    with db_cursor() as cur:
        if org_id:
            cur.execute(
                "SELECT * FROM invite_codes WHERE org_id=? ORDER BY created_at DESC",
                (org_id,),
            )
        else:
            cur.execute("SELECT * FROM invite_codes ORDER BY created_at DESC")
        return [dict(r) for r in cur.fetchall()]


def list_commission_tiers(org_id: str) -> list[dict[str, Any]]:
    with db_cursor() as cur:
        cur.execute(
            "SELECT * FROM commission_tiers WHERE org_id=? ORDER BY min_paid_users ASC",
            (org_id,),
        )
        return [dict(r) for r in cur.fetchall()]


def set_commission_tiers(org_id: str, tiers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    with db_cursor() as cur:
        cur.execute("DELETE FROM commission_tiers WHERE org_id=?", (org_id,))
        for t in tiers:
            rate = int(t["rate_bps"])
            validate_tier_rate(rate)
            tid = f"ct-{uuid4().hex[:12]}"
            cur.execute(
                """
                INSERT INTO commission_tiers (id, org_id, min_paid_users, rate_bps, created_at)
                VALUES (?,?,?,?,?)
                """,
                (tid, org_id, int(t["min_paid_users"]), rate, now_iso()),
            )
    return list_commission_tiers(org_id)


def org_dashboard_stats(org_id: str) -> dict[str, Any]:
    with db_cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) AS c FROM user_attributions WHERE org_id=?",
            (org_id,),
        )
        invited = int(cur.fetchone()["c"])
        cur.execute(
            """
            SELECT COUNT(DISTINCT po.user_id) AS c, COALESCE(SUM(po.amount_fen),0) AS gross,
                   COALESCE(SUM(ps.share_fen),0) AS shared
            FROM payment_orders po
            LEFT JOIN profit_share_orders ps ON ps.payment_order_id = po.id AND ps.wx_state='finished'
            WHERE po.org_id=? AND po.status='paid'
            """,
            (org_id,),
        )
        pay = dict(cur.fetchone())
        paid_users = int(pay.get("c") or 0)
        rate_bps = match_commission_rate_bps(org_id, paid_users)
    pending_share = 0
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT COALESCE(SUM(share_fen),0) AS s FROM profit_share_orders
            WHERE org_id=? AND wx_state IN ('held','pending','processing','pending_manual','submitting')
            """,
            (org_id,),
        )
        row = cur.fetchone()
        pending_share = int(row["s"] if row else 0)
    return {
        "org_id": org_id,
        "invited_users": invited,
        "paid_users": paid_users,
        "gross_fen": int(pay.get("gross") or 0),
        "shared_fen": int(pay.get("shared") or 0),
        "pending_share_fen": pending_share,
        "current_rate_bps": rate_bps,
        "current_rate_pct": rate_bps / 100.0,
    }


def list_org_attributions(org_id: str, limit: int = 100) -> list[dict[str, Any]]:
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT ua.user_id, ua.bound_at, u.email, u.display_name, ic.code AS invite_code,
              (SELECT COUNT(*) FROM payment_orders po WHERE po.user_id=ua.user_id AND po.org_id=ua.org_id AND po.status='paid') AS paid_orders
            FROM user_attributions ua
            JOIN users u ON u.id = ua.user_id
            LEFT JOIN invite_codes ic ON ic.id = ua.invite_code_id
            WHERE ua.org_id=?
            ORDER BY ua.bound_at DESC
            LIMIT ?
            """,
            (org_id, limit),
        )
        return [dict(r) for r in cur.fetchall()]


ACTIVATION_CODE_RE = re.compile(r"^[A-Z0-9]{6,16}$")


def _gen_activation_code() -> str:
    # Avoid ambiguous chars (0/O, 1/I)
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    from secrets import choice

    return "".join(choice(alphabet) for _ in range(8))


def list_activation_codes(limit: int = 100) -> list[dict[str, Any]]:
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT pac.*,
                   u.email AS used_by_email,
                   u.display_name AS used_by_name,
                   o.name AS org_name
            FROM partner_activation_codes pac
            LEFT JOIN users u ON u.id = pac.used_by
            LEFT JOIN organizations o ON o.id = pac.org_id
            ORDER BY pac.created_at DESC
            LIMIT ?
            """,
            (limit,),
        )
        return [dict(r) for r in cur.fetchall()]


def create_activation_code(
    *,
    created_by: str | None,
    note: str | None = None,
    expires_at: str | None = None,
    code: str | None = None,
) -> dict[str, Any]:
    raw = normalize_code(code) if code else _gen_activation_code()
    if not ACTIVATION_CODE_RE.match(raw):
        raise ValueError("开通码格式无效（6–16 位大写字母数字）")
    aid = f"pac-{uuid4().hex[:12]}"
    with db_cursor() as cur:
        cur.execute("SELECT id FROM partner_activation_codes WHERE UPPER(code)=?", (raw,))
        if cur.fetchone():
            if code:
                raise ValueError("开通码已存在")
            for _ in range(8):
                raw = _gen_activation_code()
                cur.execute("SELECT id FROM partner_activation_codes WHERE UPPER(code)=?", (raw,))
                if not cur.fetchone():
                    break
            else:
                raise ValueError("无法生成唯一开通码")
        cur.execute(
            """
            INSERT INTO partner_activation_codes (
              id, code, note, status, max_uses, used_count, expires_at, created_by, created_at
            ) VALUES (?,?,?,?,1,0,?,?,?)
            """,
            (aid, raw, (note or "").strip() or None, "active", expires_at, created_by, now_iso()),
        )
        cur.execute("SELECT * FROM partner_activation_codes WHERE id=?", (aid,))
        row = cur.fetchone()
        return dict(row) if row else {}


def get_activation_code(code: str) -> dict[str, Any] | None:
    c = normalize_code(code)
    if not c:
        return None
    with db_cursor() as cur:
        cur.execute(
            "SELECT * FROM partner_activation_codes WHERE UPPER(code)=?",
            (c,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def user_has_org_account(user_id: str) -> bool:
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT 1
            FROM org_accounts oa
            JOIN users u ON LOWER(u.email) = LOWER(oa.email)
            WHERE u.id=? AND oa.status='active'
            LIMIT 1
            """,
            (user_id,),
        )
        return bool(cur.fetchone())


def _unique_invite_code(cur: Any, preferred: str) -> str:
    code = preferred
    for _ in range(8):
        cur.execute("SELECT 1 FROM invite_codes WHERE UPPER(code)=?", (code,))
        if not cur.fetchone():
            return code
        code = f"P{uuid4().hex[:10].upper()}"
    raise RuntimeError("unable to allocate unique invite code")


def activate_partner_with_code(
    *,
    user_id: str,
    code: str,
    org_name: str | None = None,
) -> dict[str, Any]:
    """Redeem a one-time activation code: create org + org_accounts for this user.

    Keeps users.role unchanged (learner stays learner) so learning portal remains.
    """
    if user_has_org_account(user_id):
        raise ValueError("已是机构账号")

    pac = get_activation_code(code)
    if not pac:
        raise ValueError("开通码无效")
    if pac.get("status") != "active":
        raise ValueError("开通码已失效")
    max_uses = int(pac.get("max_uses") or 1)
    used_count = int(pac.get("used_count") or 0)
    if used_count >= max_uses:
        raise ValueError("开通码已使用")
    if pac.get("expires_at"):
        from datetime import datetime, timezone

        exp = pac["expires_at"]
        if hasattr(exp, "timestamp") and exp.timestamp() < datetime.now(timezone.utc).timestamp():
            raise ValueError("开通码已过期")

    with db_cursor() as cur:
        cur.execute(
            """
            SELECT id, email, display_name, password_hash, wx_mp_openid, wx_nickname, role
            FROM users WHERE id=?
            """,
            (user_id,),
        )
        user = cur.fetchone()
        if not user:
            raise ValueError("用户不存在")
        user = dict(user)
        email = str(user.get("email") or "").strip()
        if not email:
            raise ValueError("账号缺少邮箱，无法开通机构")
        pw = user.get("password_hash")
        if not pw:
            raise ValueError("账号状态异常，请联系运营")

        # Re-check race: another redeem may have completed
        cur.execute(
            """
            SELECT 1 FROM org_accounts oa
            WHERE LOWER(oa.email)=LOWER(?) AND oa.status='active'
            LIMIT 1
            """,
            (email,),
        )
        if cur.fetchone():
            raise ValueError("已是机构账号")

        # Lock activation row
        cur.execute(
            """
            SELECT * FROM partner_activation_codes
            WHERE id=? AND status='active'
            FOR UPDATE
            """,
            (pac["id"],),
        )
        locked = cur.fetchone()
        if not locked:
            raise ValueError("开通码已失效")
        locked = dict(locked)
        if int(locked.get("used_count") or 0) >= int(locked.get("max_uses") or 1):
            raise ValueError("开通码已使用")

        display = (user.get("display_name") or user.get("wx_nickname") or email.split("@")[0] or "机构").strip()
        name = (org_name or "").strip() or f"{display[:40]}的机构"
        oid = f"org-u-{uuid4().hex[:12]}"
        openid = (user.get("wx_mp_openid") or "").strip() or None
        nickname = (user.get("wx_nickname") or "").strip() or None
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
                display[:64],
                email,
                "PERSONAL_OPENID" if openid else None,
                openid,
                nickname or (display if openid else None),
                ts,
                ts,
            ),
        )
        oa_id = f"oa-{uuid4().hex[:12]}"
        cur.execute(
            """
            INSERT INTO org_accounts (id, org_id, email, password_hash, display_name, status, created_at)
            VALUES (?,?,?,?,?,?,?)
            """,
            (oa_id, oid, email, pw, display[:64], "active", ts),
        )
        # Default commission: 30% for invite-link attributed orders
        cur.execute(
            """
            INSERT INTO commission_tiers (id, org_id, min_paid_users, rate_bps, created_at)
            VALUES (?,?,?,?,?)
            """,
            (f"ct-{uuid4().hex[:12]}", oid, 0, 3000, ts),
        )
        preferred = f"P{re.sub(r'[^A-Za-z0-9]', '', user_id).upper()[:10]}" or f"P{uuid4().hex[:10].upper()}"
        invite = _unique_invite_code(cur, preferred if CODE_RE.match(preferred) else f"P{uuid4().hex[:10].upper()}")
        cur.execute(
            """
            INSERT INTO invite_codes (
              id, org_id, code, offering_id, status, max_uses, used_count, expires_at, created_by, created_at
            ) VALUES (?,?,?,?,?,?,0,?,?,?)
            """,
            (f"ic-{uuid4().hex[:12]}", oid, invite, None, "active", None, None, user_id, ts),
        )
        new_used = int(locked.get("used_count") or 0) + 1
        new_status = "used" if new_used >= int(locked.get("max_uses") or 1) else "active"
        cur.execute(
            """
            UPDATE partner_activation_codes
            SET used_count=?, status=?, used_by=?, used_at=?, org_id=?
            WHERE id=?
            """,
            (new_used, new_status, user_id, ts, oid, pac["id"]),
        )

    org = get_organization(oid) or {}
    return {
        "org": org,
        "org_id": oid,
        "invite_code": invite,
        "activation_code": normalize_code(code),
    }
