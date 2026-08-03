"""WeChat MP HTTP routes — server verify + event callback."""

from __future__ import annotations

import logging
import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import PlainTextResponse

_PKG_ROOT = Path(__file__).resolve().parents[2]
if str(_PKG_ROOT) not in sys.path:
    sys.path.insert(0, str(_PKG_ROOT))

from services.shared.config import WECHAT_MP_AES_KEY  # noqa: E402
from services.wechat_mp import crypto as mp_crypto  # noqa: E402
from services.wechat_mp import login as mp_login  # noqa: E402

router = APIRouter(tags=["wechat-mp"])
log = logging.getLogger("fde.wechat_mp")


@router.get("/api/v1/wechat/mp")
def mp_verify(
    signature: str = Query(""),
    timestamp: str = Query(""),
    nonce: str = Query(""),
    echostr: str = Query(""),
) -> Response:
    """WeChat server URL verification (GET)."""
    if not mp_crypto.check_signature(signature, timestamp, nonce):
        raise HTTPException(403, "invalid signature")
    return PlainTextResponse(echostr or "")


@router.post("/api/v1/wechat/mp")
async def mp_callback(
    request: Request,
    signature: str = Query(""),
    timestamp: str = Query(""),
    nonce: str = Query(""),
    msg_signature: str = Query(""),
    encrypt_type: str = Query(""),
) -> Response:
    """Receive subscribe / SCAN events for login QR."""
    if signature and not msg_signature:
        if not mp_crypto.check_signature(signature, timestamp, nonce):
            raise HTTPException(403, "invalid signature")
    raw = await request.body()
    try:
        xml_text = mp_login.extract_inbound_xml(
            raw,
            msg_signature=msg_signature or "",
            timestamp=timestamp,
            nonce=nonce,
        )
    except Exception as exc:
        log.warning("mp xml parse/decrypt failed: %s", exc)
        raise HTTPException(400, "bad xml") from exc

    msg = mp_login.parse_xml(xml_text)
    reply_text = mp_login.handle_mp_xml(xml_text)
    if not reply_text:
        return PlainTextResponse("success")

    to_openid = msg.get("FromUserName") or ""
    from_gh = msg.get("ToUserName") or ""
    reply_xml = mp_login.wrap_text_reply(
        to_openid=to_openid, from_gh=from_gh, content=reply_text
    )

    want_encrypt = (encrypt_type or "").lower() == "aes" or "<Encrypt>" in raw.decode(
        "utf-8", errors="ignore"
    )
    if want_encrypt and WECHAT_MP_AES_KEY:
        try:
            enc = mp_crypto.encrypt_message(reply_xml)
            out = (
                f"<xml>"
                f"<Encrypt><![CDATA[{enc['Encrypt']}]]></Encrypt>"
                f"<MsgSignature><![CDATA[{enc['MsgSignature']}]]></MsgSignature>"
                f"<TimeStamp>{enc['TimeStamp']}</TimeStamp>"
                f"<Nonce><![CDATA[{enc['Nonce']}]]></Nonce>"
                f"</xml>"
            )
            return Response(content=out, media_type="application/xml")
        except Exception as exc:
            log.warning("mp encrypt reply failed, fallback plain: %s", exc)

    return Response(content=reply_xml, media_type="application/xml")
