"""JSAPI checkout uses the current-WeChat cookie, not users.wx_mp_openid."""

from __future__ import annotations

import types
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from services.shared.auth_constants import JSAPI_OPENID_COOKIE


@pytest.fixture(scope="module", autouse=True)
def _bootstrap(require_postgres):
    from services.migrations_runner.__main__ import run_migrations
    from services.shared.seed import seed_defaults

    run_migrations()
    seed_defaults()
    yield


def _make_user(*, openid: str | None = None) -> dict:
    from services.shared import db_cursor, now_iso
    from services.shared.seed import hash_password

    uid = str(uuid.uuid4())
    suffix = uid[:8]
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO users (id, email, password_hash, display_name, role, created_at, wx_mp_openid)
            VALUES (?,?,?,?, 'learner', ?, ?)
            """,
            (uid, f"jsapi-{suffix}@fde.local", hash_password("x"), "微信用户", now_iso(), openid),
        )
        camp_id = f"testcamp-jsapi-{suffix}"
        version_id = str(uuid.uuid4())
        offering_id = str(uuid.uuid4())
        cur.execute("INSERT INTO camps (id, name, version) VALUES (?,?, 'v0.3')", (camp_id, f"JSAPI {suffix}"))
        cur.execute(
            """
            INSERT INTO course_versions (id, camp_id, version_tag, status, title, created_at)
            VALUES (?,?,?,?,?,NOW())
            """,
            (version_id, camp_id, f"v-{suffix}", "published", "JSAPI Course"),
        )
        cur.execute(
            """
            INSERT INTO course_offerings (id, course_version_id, camp_id, title, status, price_fen, created_at)
            VALUES (?,?,?,?, 'active', 198000, NOW())
            """,
            (offering_id, version_id, camp_id, "JSAPI Offering"),
        )
    return {"id": uid, "offering_id": offering_id, "camp_id": camp_id, "version_id": version_id}


def _cleanup(ctx: dict) -> None:
    from services.shared import db_cursor

    with db_cursor() as cur:
        cur.execute("DELETE FROM payment_orders WHERE user_id=?", (ctx["id"],))
        cur.execute("DELETE FROM course_offerings WHERE id=?", (ctx["offering_id"],))
        cur.execute("DELETE FROM course_versions WHERE id=?", (ctx["version_id"],))
        cur.execute("DELETE FROM camps WHERE id=?", (ctx["camp_id"],))
        cur.execute("DELETE FROM users WHERE id=?", (ctx["id"],))


def _req(user_id: str, email: str, cookies: dict[str, str] | None = None):
    from services.shared import AuthUser

    return types.SimpleNamespace(
        state=types.SimpleNamespace(
            user=AuthUser(id=user_id, email=email, role="learner", display_name="微信用户"),
            session_replaced=False,
        ),
        cookies=cookies or {},
    )


def test_with_pay_flag_appends_once():
    from services.wechat_mp.jsapi_openid import with_pay_flag

    assert with_pay_flag("/app/shop") == "/app/shop?pay=1"
    assert with_pay_flag("/app/shop?x=1") == "/app/shop?x=1&pay=1"
    assert with_pay_flag("/app/shop?pay=1") == "/app/shop?pay=1"


def test_jsapi_checkout_without_cookie_asks_jsapi_oauth_not_mp_entry():
    from services.billing.app import CheckoutBody, checkout

    ctx = _make_user(openid="o-bound-old")
    try:
        req = _req(ctx["id"], f"jsapi-{ctx['id'][:8]}@fde.local")
        with pytest.raises(HTTPException) as exc:
            checkout(CheckoutBody(offering_id=ctx["offering_id"], pay_mode="jsapi"), req)  # type: ignore[arg-type]
        assert exc.value.status_code == 409
        detail = exc.value.detail
        assert isinstance(detail, dict)
        assert detail["code"] == "need_wechat_oauth"
        url = detail.get("oauth_url") or ""
        assert "jsapi-openid" in url
        assert "mp-entry" not in url
    finally:
        _cleanup(ctx)


def test_jsapi_checkout_uses_cookie_not_bound_openid():
    from services.billing.app import CheckoutBody, checkout
    from services.shared import db_cursor

    ctx = _make_user(openid="o-bound-login")
    try:
        req = _req(
            ctx["id"],
            f"jsapi-{ctx['id'][:8]}@fde.local",
            cookies={JSAPI_OPENID_COOKIE: "o-current-payer"},
        )
        with patch("services.billing.wechat_pay.configured", return_value=False), patch(
            "services.billing.wechat_pay.FDE_ENV", "test"
        ):
            out = checkout(CheckoutBody(offering_id=ctx["offering_id"], pay_mode="jsapi"), req)  # type: ignore[arg-type]
        assert out["pay_mode"] == "jsapi"
        assert out["payer_differs_from_login"] is True
        with db_cursor() as cur:
            cur.execute("SELECT wx_payer_openid FROM payment_orders WHERE id=?", (out["order_id"],))
            assert dict(cur.fetchone())["wx_payer_openid"] == "o-current-payer"
            cur.execute("SELECT wx_mp_openid FROM users WHERE id=?", (ctx["id"],))
            assert dict(cur.fetchone())["wx_mp_openid"] == "o-bound-login"
    finally:
        _cleanup(ctx)


def test_jsapi_pending_not_reused_for_other_payer():
    from services.billing.app import CheckoutBody, checkout
    from services.shared import db_cursor

    ctx = _make_user(openid="o-bound-login")
    try:
        req_a = _req(ctx["id"], "a@fde.local", cookies={JSAPI_OPENID_COOKIE: "o-payer-a"})
        with patch("services.billing.wechat_pay.configured", return_value=False), patch(
            "services.billing.wechat_pay.FDE_ENV", "test"
        ):
            first = checkout(CheckoutBody(offering_id=ctx["offering_id"], pay_mode="jsapi"), req_a)  # type: ignore[arg-type]
        first_id = first["order_id"]
        req_b = _req(ctx["id"], "a@fde.local", cookies={JSAPI_OPENID_COOKIE: "o-payer-b"})
        with patch("services.billing.wechat_pay.configured", return_value=False), patch(
            "services.billing.wechat_pay.FDE_ENV", "test"
        ):
            second = checkout(CheckoutBody(offering_id=ctx["offering_id"], pay_mode="jsapi"), req_b)  # type: ignore[arg-type]
        assert second["order_id"] != first_id
        assert second.get("reused") is False
        with db_cursor() as cur:
            cur.execute("SELECT status FROM payment_orders WHERE id=?", (first_id,))
            assert dict(cur.fetchone())["status"] == "expired"
            cur.execute("SELECT wx_payer_openid FROM payment_orders WHERE id=?", (second["order_id"],))
            assert dict(cur.fetchone())["wx_payer_openid"] == "o-payer-b"
    finally:
        _cleanup(ctx)


def test_jsapi_pending_reused_for_same_payer():
    from services.billing.app import CheckoutBody, checkout

    ctx = _make_user(openid="o-bound-login")
    try:
        req = _req(ctx["id"], "a@fde.local", cookies={JSAPI_OPENID_COOKIE: "o-payer-same"})
        with patch("services.billing.wechat_pay.configured", return_value=False), patch(
            "services.billing.wechat_pay.FDE_ENV", "test"
        ):
            first = checkout(CheckoutBody(offering_id=ctx["offering_id"], pay_mode="jsapi"), req)  # type: ignore[arg-type]
            second = checkout(CheckoutBody(offering_id=ctx["offering_id"], pay_mode="jsapi"), req)  # type: ignore[arg-type]
        assert second["order_id"] == first["order_id"]
        assert second.get("reused") is True
    finally:
        _cleanup(ctx)


def test_complete_jsapi_openid_does_not_resolve_user():
    from services.shared import db_cursor, now_iso
    from services.wechat_mp import jsapi_openid as jsapi_ox

    sid = uuid.uuid4().hex[:16]
    exp = datetime.now(timezone.utc) + timedelta(minutes=15)
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO wechat_login_states (id, created_at, expires_at, status, next_path, purpose)
            VALUES (?,?,?,?,?, 'jsapi')
            """,
            (sid, now_iso(), exp.isoformat(), "pending", "/app/shop"),
        )
    try:
        with patch.object(jsapi_ox.mp_entry, "_exchange_code", return_value={"openid": "o-from-wechat"}):
            with patch("services.wechat_mp.login.resolve_or_create_user") as resolve:
                result = jsapi_ox.complete_jsapi_openid("code", sid)
                resolve.assert_not_called()
        assert result.openid == "o-from-wechat"
        assert result.next_path == "/app/shop"
        replay = jsapi_ox.complete_jsapi_openid("code", sid)
        assert replay.openid is None
    finally:
        with db_cursor() as cur:
            cur.execute("DELETE FROM wechat_login_states WHERE id=?", (sid,))
