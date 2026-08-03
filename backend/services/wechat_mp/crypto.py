"""WeChat Official Account (MP) signature + message AES crypto."""

from __future__ import annotations

import base64
import hashlib
import logging
import struct
from typing import Any

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

from services.shared.config import WECHAT_MP_AES_KEY, WECHAT_MP_TOKEN, WECHAT_PAY_APP_ID

log = logging.getLogger("fde.wechat_mp.crypto")


def check_signature(signature: str, timestamp: str, nonce: str) -> bool:
    token = WECHAT_MP_TOKEN or ""
    if not token or not signature:
        return False
    parts = sorted([token, str(timestamp or ""), str(nonce or "")])
    digest = hashlib.sha1("".join(parts).encode("utf-8")).hexdigest()
    return digest == signature


def _aes_key() -> bytes:
    raw = (WECHAT_MP_AES_KEY or "").strip()
    if not raw:
        raise RuntimeError("WECHAT_MP_AES_KEY 未配置")
    # EncodingAESKey is 43 chars; pad to standard base64
    pad = "=" * ((4 - len(raw) % 4) % 4)
    key = base64.b64decode(raw + pad)
    if len(key) != 32:
        raise RuntimeError(f"WECHAT_MP_AES_KEY 解码后长度异常: {len(key)}")
    return key


def decrypt_message(encrypt_b64: str) -> str:
    """Decrypt WeChat safe-mode Encrypt payload → XML string."""
    key = _aes_key()
    iv = key[:16]
    data = base64.b64decode(encrypt_b64)
    decryptor = Cipher(algorithms.AES(key), modes.CBC(iv)).decryptor()
    plain = decryptor.update(data) + decryptor.finalize()
    pad = plain[-1]
    if isinstance(pad, str):
        pad = ord(pad)
    if pad < 1 or pad > 32:
        raise ValueError("invalid pkcs7 pad")
    content = plain[:-pad]
    # random(16) + msg_len(4 network) + msg + appid
    msg_len = struct.unpack("!I", content[16:20])[0]
    xml = content[20 : 20 + msg_len].decode("utf-8")
    appid = content[20 + msg_len :].decode("utf-8")
    expect = WECHAT_PAY_APP_ID or ""
    if expect and appid and appid != expect:
        log.warning("mp decrypt appid mismatch: got=%s expect=%s", appid, expect)
    return xml


def encrypt_message(reply_xml: str) -> dict[str, Any]:
    """Encrypt reply XML for safe mode — returns fields for Encrypted response."""
    import os
    import time

    key = _aes_key()
    iv = key[:16]
    appid = (WECHAT_PAY_APP_ID or "").encode("utf-8")
    msg = reply_xml.encode("utf-8")
    raw = os.urandom(16) + struct.pack("!I", len(msg)) + msg + appid
    # PKCS7 pad to 32
    pad = 32 - (len(raw) % 32)
    raw = raw + bytes([pad] * pad)
    encryptor = Cipher(algorithms.AES(key), modes.CBC(iv)).encryptor()
    cipher = encryptor.update(raw) + encryptor.finalize()
    encrypt_b64 = base64.b64encode(cipher).decode("ascii")
    timestamp = str(int(time.time()))
    nonce = base64.urlsafe_b64encode(os.urandom(8)).decode("ascii").rstrip("=")
    token = WECHAT_MP_TOKEN or ""
    parts = sorted([token, timestamp, nonce, encrypt_b64])
    signature = hashlib.sha1("".join(parts).encode("utf-8")).hexdigest()
    return {
        "Encrypt": encrypt_b64,
        "MsgSignature": signature,
        "TimeStamp": timestamp,
        "Nonce": nonce,
    }
