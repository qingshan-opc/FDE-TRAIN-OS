"""Minimal certificate chain tests."""

from __future__ import annotations

from services.chain.hash_utils import hash_id_number, normalize_id_number, tx_content_hash
from services.chain.ledger import anchor_certificate_tx, get_cert_transactions, verify_chain


def test_id_hash_deterministic():
    assert normalize_id_number(" 110101199001011234 ") == "110101199001011234"
    h1 = hash_id_number("110101199001011234")
    h2 = hash_id_number("110101199001011234")
    assert h1 == h2
    assert len(h1) == 64


def test_anchor_and_verify_chain(require_postgres):
    meta = anchor_certificate_tx(
        cert_id="FDE-TESTCHAIN001",
        holder_name="张三",
        course_title="FDE 测试课",
        issued_at="2026-07-28T00:00:00+00:00",
        id_number_sha256=hash_id_number("110101199001011234"),
    )
    assert meta["chain_block_height"] >= 1
    assert meta["chain_tx_hash"]
    txs = get_cert_transactions("FDE-TESTCHAIN001")
    assert len(txs) >= 1
    payload = txs[0]["payload_json"]
    if isinstance(payload, str):
        import json
        payload = json.loads(payload)
    assert payload["holder_name"] == "张三"
    assert payload["id_number_sha256"]
    integrity = verify_chain()
    assert integrity["valid"] is True
