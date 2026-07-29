"""Hash helpers for certificate chain — algorithms are public and documented."""

from __future__ import annotations

import hashlib
import json
from typing import Any

CHAIN_NETWORK = "FDE-Cert-Chain-v1"
ID_HASH_ALGORITHM = "SHA256"
ID_HASH_ALGORITHM_LABEL = "SHA-256"
# 公开文档用中文描述
ID_HASH_NORMALIZATION = "strip_whitespace_then_uppercase"
ID_HASH_NORMALIZATION_LABEL = "去除首尾空格、去除内部空格、字母大写"
ID_HASH_STEPS_ZH = [
    "去除证件号首尾空格",
    "去除证件号内部空格",
    "将英文字母转为大写（ASCII）",
    "对 UTF-8 字节串做 SHA-256，得到小写十六进制摘要",
]


def normalize_id_number(id_number: str) -> str:
    return (id_number or "").strip().replace(" ", "").upper()


def hash_id_number(id_number: str) -> str:
    """SHA256 hex digest of normalized ID number — raw ID never stored."""
    normalized = normalize_id_number(id_number)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def canonical_json(data: dict[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_hex(data: str | bytes) -> str:
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def tx_content_hash(payload: dict[str, Any]) -> str:
    return sha256_hex(canonical_json(payload))


def merkle_root(tx_hashes: list[str]) -> str:
    if not tx_hashes:
        return "0" * 64
    if len(tx_hashes) == 1:
        return tx_hashes[0]
    combined = "".join(sorted(tx_hashes))
    return sha256_hex(combined)


def block_hash(height: int, prev_hash: str, merkle: str, mined_at_epoch: int, tx_count: int) -> str:
    material = f"{height}|{prev_hash}|{merkle}|{mined_at_epoch}|{tx_count}|{CHAIN_NETWORK}"
    return sha256_hex(material)
