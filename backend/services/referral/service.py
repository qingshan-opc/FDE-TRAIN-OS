"""Learner referral domain — user-level invite codes and commission tiers."""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from services.partners.service import MAX_RATE_BPS, normalize_code
from services.shared import db_cursor, now_iso

LEARNER_REFERRAL_TIERS: list[tuple[int, int]] = [(0, 2000), (5, 2500), (10, 3000)]


def match_learner_rate_bps(invite_count: int) -> int:
    rate = 0
    for min_count, bps in LEARNER_REFERRAL_TIERS:
        if invite_count >= min_count:
            rate = bps
    return min(rate, MAX_RATE_BPS)


def _next_tier(invite_count: int) -> dict[str, Any] | None:
    for min_count, bps in LEARNER_REFERRAL_TIERS:
        if invite_count < min_count:
            return {
                "min_invites": min_count,
                "rate_bps": bps,
                "rate_percent": bps / 100.0,
                "invites_needed": min_count - invite_count,
            }
    return None


def _new_code() -> str:
    return "L" + uuid4().hex[:8].upper()


def _mask_openid(openid: str | None) -> str | None:
    val = (openid or "").strip()
    if not val:
        return None
    if len(val) <= 8:
        return val[:2] + "****"
    return f"{val[:4]}****{val[-4:]}"


def ensure_learner_invite_code(user_id: str) -> dict[str, Any]:
    with db_cursor() as cur:
        cur.execute("SELECT * FROM learner_invite_codes WHERE user_id=?", (user_id,))
        row = cur.fetchone()
        if row:
            return dict(row)
        for _ in range(8):
            code = _new_code()
            lid = f"lic-{uuid4().hex[:12]}"
            cur.execute(
                """
                SELECT 1 FROM learner_invite_codes WHERE code=?
                UNION ALL SELECT 1 FROM invite_codes WHERE UPPER(code)=?
                """,
                (code, code),
            )
            if cur.fetchone():
                continue
            cur.execute(
                """
                INSERT INTO learner_invite_codes (id, user_id, code, status, used_count, created_at)
                VALUES (?,?,?,?,0,?)
                """,
                (lid, user_id, code, "active", now_iso()),
            )
            cur.execute("SELECT * FROM learner_invite_codes WHERE id=?", (lid,))
            created = cur.fetchone()
            if created:
                return dict(created)
    raise RuntimeError("无法生成唯一邀请码")


def resolve_learner_invite_code(code: str) -> dict[str, Any] | None:
    c = normalize_code(code)
    if not c or not c.startswith("L"):
        return None
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT lic.*, u.display_name AS referrer_display_name, u.email AS referrer_email
            FROM learner_invite_codes lic
            JOIN users u ON u.id = lic.user_id
            WHERE UPPER(lic.code)=? AND lic.status='active'
              AND u.role IN ('learner', 'partner', 'author', 'admin')
            """,
            (c,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def get_user_referral(user_id: str) -> dict[str, Any] | None:
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT ur.*, u.display_name AS referrer_display_name, u.email AS referrer_email,
                   lic.code AS invite_code
            FROM user_referrals ur
            JOIN users u ON u.id = ur.referrer_user_id
            LEFT JOIN learner_invite_codes lic ON lic.id = ur.invite_code_id
            WHERE ur.user_id=?
            """,
            (user_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def bind_learner_invite_code(user_id: str, code: str) -> dict[str, Any]:
    from services.partners.service import get_user_attribution

    if get_user_attribution(user_id):
        raise ValueError("已有机构渠道归因，无法绑定学员邀请")
    if get_user_referral(user_id):
        raise ValueError("已绑定推荐人，不可更改")
    ic = resolve_learner_invite_code(code)
    if not ic:
        raise ValueError("邀请码无效或已失效")
    referrer_id = ic["user_id"]
    if referrer_id == user_id:
        raise ValueError("不能使用自己的邀请码")
    invite_code_id = ic["id"]
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO user_referrals (user_id, referrer_user_id, invite_code_id, bound_at)
            VALUES (?,?,?,?)
            """,
            (user_id, referrer_id, invite_code_id, now_iso()),
        )
        cur.execute(
            "UPDATE learner_invite_codes SET used_count = used_count + 1 WHERE id=?",
            (invite_code_id,),
        )
    return get_user_referral(user_id) or {"user_id": user_id, "referrer_user_id": referrer_id}


def bind_any_invite_code(user_id: str, code: str) -> dict[str, Any]:
    """Try org attribution first, then learner referral."""
    from services.partners.service import bind_invite_code, get_user_attribution

    if get_user_attribution(user_id):
        raise ValueError("已绑定渠道，不可更改")
    if get_user_referral(user_id):
        raise ValueError("已绑定推荐人，不可更改")
    try:
        row = bind_invite_code(user_id, code)
        return {"kind": "org", **row}
    except ValueError as org_exc:
        msg = str(org_exc)
        if "已绑定" in msg:
            raise
        try:
            row = bind_learner_invite_code(user_id, code)
            return {"kind": "learner", **row}
        except ValueError:
            raise org_exc from None


def count_learner_invites(referrer_user_id: str) -> int:
    with db_cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) AS c FROM user_referrals WHERE referrer_user_id=?",
            (referrer_user_id,),
        )
        row = cur.fetchone()
        return int(row["c"] if row else 0)


def list_referral_attributions(referrer_user_id: str, limit: int = 100) -> list[dict[str, Any]]:
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT ur.user_id, ur.bound_at, u.email, u.display_name, lic.code AS invite_code,
              (SELECT COUNT(*) FROM payment_orders po
               WHERE po.user_id=ur.user_id AND po.referrer_user_id=ur.referrer_user_id
                 AND po.status='paid') AS paid_orders
            FROM user_referrals ur
            JOIN users u ON u.id = ur.user_id
            LEFT JOIN learner_invite_codes lic ON lic.id = ur.invite_code_id
            WHERE ur.referrer_user_id=?
            ORDER BY ur.bound_at DESC
            LIMIT ?
            """,
            (referrer_user_id, limit),
        )
        return [dict(r) for r in cur.fetchall()]


def list_referral_profit_shares(referrer_user_id: str, limit: int = 100) -> list[dict[str, Any]]:
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT ps.*, po.out_trade_no, po.amount_fen, po.paid_at, u.email AS buyer_email,
                   u.display_name AS buyer_name
            FROM profit_share_orders ps
            JOIN payment_orders po ON po.id = ps.payment_order_id
            JOIN users u ON u.id = po.user_id
            WHERE ps.referrer_user_id=? AND ps.beneficiary_kind='learner'
            ORDER BY ps.created_at DESC
            LIMIT ?
            """,
            (referrer_user_id, limit),
        )
        return [dict(r) for r in cur.fetchall()]


def referral_dashboard(user_id: str, register_url: str) -> dict[str, Any]:
    code_row = ensure_learner_invite_code(user_id)
    code = code_row.get("code") or ""
    invite_count = count_learner_invites(user_id)
    rate_bps = match_learner_rate_bps(invite_count)
    with db_cursor() as cur:
        cur.execute("SELECT wx_mp_openid FROM users WHERE id=?", (user_id,))
        urow = cur.fetchone()
    openid = (dict(urow).get("wx_mp_openid") if urow else None) or ""
    return {
        "code": code,
        "register_url": register_url,
        "invite_count": invite_count,
        "rate_bps": rate_bps,
        "rate_percent": rate_bps / 100.0,
        "next_tier": _next_tier(invite_count),
        "attributions": list_referral_attributions(user_id, limit=50),
        "profit_shares": list_referral_profit_shares(user_id, limit=50),
        "receiver": {
            "bound": bool(openid.strip()),
            "wx_mp_openid": _mask_openid(openid),
        },
    }
