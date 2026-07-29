"""Public chain explorer API."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from services.chain import hash_utils, ledger  # noqa: E402
from services.shared import init_schema  # noqa: E402
from services.shared.config import API_PAGE_SIZE_MAX  # noqa: E402

router = APIRouter(tags=["chain"])
init_schema()


@router.get("/api/v1/chain/stats")
def chain_stats() -> dict[str, Any]:
    stats = ledger.chain_stats()
    integrity = ledger.verify_chain()
    return {**stats, "integrity": integrity}


@router.get("/api/v1/chain/verify")
def verify_chain() -> dict[str, Any]:
    return ledger.verify_chain()


@router.get("/api/v1/chain/blocks")
def list_blocks(limit: int = 20, offset: int = 0) -> dict[str, Any]:
    limit = min(max(limit, 1), API_PAGE_SIZE_MAX)
    offset = max(offset, 0)
    items = ledger.list_blocks(limit=limit, offset=offset)
    return {"items": items, "limit": limit, "offset": offset}


@router.get("/api/v1/chain/blocks/{height}")
def get_block(height: int) -> dict[str, Any]:
    block = ledger.get_block(height)
    if not block:
        raise HTTPException(404, "区块不存在")
    return {"block": block}


@router.get("/api/v1/chain/tx/{tx_hash}")
def get_tx(tx_hash: str) -> dict[str, Any]:
    tx = ledger.get_transaction(tx_hash)
    if not tx:
        raise HTTPException(404, "交易不存在")
    payload = tx.get("payload_json")
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except Exception:
            pass
    tx["payload"] = payload
    return {"transaction": tx}


@router.get("/api/v1/chain/cert/{cert_id}")
def cert_on_chain(cert_id: str) -> dict[str, Any]:
    txs = ledger.get_cert_transactions(cert_id)
    if not txs:
        raise HTTPException(404, "链上未找到该证书")
    for tx in txs:
        p = tx.get("payload_json")
        if isinstance(p, str):
            try:
                tx["payload"] = json.loads(p)
            except Exception:
                tx["payload"] = p
        else:
            tx["payload"] = p
    return {"cert_id": cert_id, "transactions": txs}


@router.get("/api/v1/chain/algorithms")
def chain_algorithms() -> dict[str, Any]:
    """Public documentation of hash algorithms for independent verification."""
    return {
        "network": hash_utils.CHAIN_NETWORK,
        "id_hash_algorithm": hash_utils.ID_HASH_ALGORITHM_LABEL,
        "id_hash_normalization": hash_utils.ID_HASH_NORMALIZATION_LABEL,
        "id_hash_steps": hash_utils.ID_HASH_STEPS_ZH,
        "id_hash_example": {
            "input": "110101199001011234",
            "normalized": "110101199001011234",
            "note": "对规范化后的字符串做 SHA-256，与链上 id_number_sha256 字段比对",
        },
        "tx_hash": "SHA256(规范 JSON 载荷，键排序，无空格)",
        "block_hash": "SHA256(高度|前一区块哈希|默克尔根|挖矿时间戳|交易数|网络标识)",
    }
