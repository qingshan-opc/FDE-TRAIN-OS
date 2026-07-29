"""Certificate chain ledger — append-only blocks linked by hash."""

from __future__ import annotations

import logging
import time
from typing import Any
from uuid import uuid4

from services.chain.hash_utils import (
    CHAIN_NETWORK,
    ID_HASH_ALGORITHM,
    ID_HASH_NORMALIZATION,
    block_hash,
    merkle_root,
    tx_content_hash,
)
from services.shared import db_cursor, now_iso

log = logging.getLogger("fde.chain.ledger")

GENESIS_HASH = "0" * 64


def _latest_block() -> dict[str, Any]:
    with db_cursor() as cur:
        cur.execute("SELECT * FROM chain_blocks ORDER BY height DESC LIMIT 1")
        row = cur.fetchone()
    if not row:
        return {"height": -1, "block_hash": GENESIS_HASH}
    return dict(row)


def _ensure_genesis() -> None:
    with db_cursor() as cur:
        cur.execute("SELECT 1 FROM chain_blocks WHERE height=0")
        if cur.fetchone():
            return
        cur.execute(
            """
            INSERT INTO chain_blocks (height, block_hash, prev_hash, merkle_root, tx_count, mined_at, miner)
            VALUES (0, ?, ?, ?, 0, ?, 'genesis')
            """,
            (GENESIS_HASH, GENESIS_HASH, GENESIS_HASH, now_iso()),
        )


def anchor_certificate_tx(
    *,
    cert_id: str,
    holder_name: str,
    course_title: str,
    issued_at: str,
    id_number_sha256: str | None = None,
    tx_type: str = "cert_issue",
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Mine a new block containing one certificate transaction."""
    _ensure_genesis()
    payload: dict[str, Any] = {
        "type": tx_type,
        "cert_id": cert_id,
        "holder_name": holder_name,
        "course_title": course_title,
        "issued_at": issued_at,
        "id_number_sha256": id_number_sha256,
        "id_hash_algorithm": ID_HASH_ALGORITHM,
        "id_hash_normalization": ID_HASH_NORMALIZATION,
        "network": CHAIN_NETWORK,
    }
    if extra:
        payload.update(extra)
    content_hash = tx_content_hash(payload)
    tx_hash = content_hash  # content-addressed tx id

    prev = _latest_block()
    height = int(prev["height"]) + 1
    mined_at = now_iso()
    mined_epoch = int(time.time())
    merkle = merkle_root([tx_hash])
    bhash = block_hash(height, str(prev["block_hash"]), merkle, mined_epoch, 1)

    import json

    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO chain_blocks (height, block_hash, prev_hash, merkle_root, tx_count, mined_at, mined_at_epoch, miner)
            VALUES (?,?,?,?,1,?,?,?)
            """,
            (height, bhash, prev["block_hash"], merkle, mined_at, mined_epoch, "fde-node"),
        )
        cur.execute(
            """
            INSERT INTO chain_transactions
              (tx_hash, block_height, tx_type, cert_id, payload_json, content_hash, created_at)
            VALUES (?,?,?,?,?::jsonb,?,?)
            """,
            (tx_hash, height, tx_type, cert_id, json.dumps(payload, ensure_ascii=False), content_hash, mined_at),
        )
    log.info("anchored cert %s at block %s tx %s", cert_id, height, tx_hash[:16])
    return {
        "chain_provider": "fde",
        "chain_network": CHAIN_NETWORK,
        "chain_tx_hash": tx_hash,
        "chain_content_hash": content_hash,
        "chain_block_height": height,
        "chain_block_hash": bhash,
        "chain_anchor_at": mined_at,
        "chain_public_payload": payload,
    }


def get_transaction(tx_hash: str) -> dict[str, Any] | None:
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT t.*, b.block_hash, b.prev_hash, b.mined_at AS block_mined_at
            FROM chain_transactions t
            JOIN chain_blocks b ON b.height = t.block_height
            WHERE t.tx_hash=?
            """,
            (tx_hash,),
        )
        row = cur.fetchone()
    return dict(row) if row else None


def get_cert_transactions(cert_id: str) -> list[dict[str, Any]]:
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT t.*, b.block_hash
            FROM chain_transactions t
            JOIN chain_blocks b ON b.height = t.block_height
            WHERE t.cert_id=?
            ORDER BY t.block_height ASC
            """,
            (cert_id,),
        )
        return [dict(r) for r in cur.fetchall()]


def get_block(height: int) -> dict[str, Any] | None:
    with db_cursor() as cur:
        cur.execute("SELECT * FROM chain_blocks WHERE height=?", (height,))
        block = cur.fetchone()
        if not block:
            return None
        block = dict(block)
        cur.execute(
            "SELECT * FROM chain_transactions WHERE block_height=? ORDER BY created_at ASC",
            (height,),
        )
        block["transactions"] = [dict(r) for r in cur.fetchall()]
    return block


def list_blocks(limit: int = 20, offset: int = 0) -> list[dict[str, Any]]:
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT height, block_hash, prev_hash, merkle_root, tx_count, mined_at, miner
            FROM chain_blocks
            ORDER BY height DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        )
        return [dict(r) for r in cur.fetchall()]


def chain_stats() -> dict[str, Any]:
    with db_cursor() as cur:
        cur.execute("SELECT COUNT(*) AS c FROM chain_blocks")
        blocks = int(cur.fetchone()["c"])
        cur.execute("SELECT COUNT(*) AS c FROM chain_transactions")
        txs = int(cur.fetchone()["c"])
        cur.execute("SELECT MAX(height) AS h FROM chain_blocks")
        tip = cur.fetchone()["h"]
    return {
        "network": CHAIN_NETWORK,
        "block_count": blocks,
        "tx_count": txs,
        "tip_height": tip,
        "id_hash_algorithm": ID_HASH_ALGORITHM,
        "id_hash_normalization": ID_HASH_NORMALIZATION,
    }


def verify_chain() -> dict[str, Any]:
    """Walk the chain and validate hash linkage."""
    _ensure_genesis()
    errors: list[str] = []
    with db_cursor() as cur:
        cur.execute("SELECT * FROM chain_blocks ORDER BY height ASC")
        blocks = [dict(r) for r in cur.fetchall()]
    prev_hash = GENESIS_HASH
    for block in blocks:
        h = int(block["height"])
        if h == 0:
            if block["block_hash"] != GENESIS_HASH:
                errors.append("genesis hash mismatch")
            prev_hash = block["block_hash"]
            continue
        if block["prev_hash"] != prev_hash:
            errors.append(f"block {h}: prev_hash broken")
        with db_cursor() as cur:
            cur.execute("SELECT tx_hash FROM chain_transactions WHERE block_height=?", (h,))
            tx_hashes = [r["tx_hash"] for r in cur.fetchall()]
        expected_merkle = merkle_root(tx_hashes)
        if block["merkle_root"] != expected_merkle:
            errors.append(f"block {h}: merkle_root mismatch")
        expected = block_hash(
            h,
            str(block["prev_hash"]),
            expected_merkle,
            int(block.get("mined_at_epoch") or 0),
            int(block["tx_count"]),
        )
        if block["block_hash"] != expected:
            errors.append(f"block {h}: block_hash mismatch")
        prev_hash = block["block_hash"]
    return {"valid": len(errors) == 0, "errors": errors, "blocks_checked": len(blocks)}
