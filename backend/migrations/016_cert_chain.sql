-- FDE minimal certificate chain (tamper-evident ledger)

ALTER TABLE identity_verifications ADD COLUMN IF NOT EXISTS holder_name TEXT;
ALTER TABLE identity_verifications ADD COLUMN IF NOT EXISTS id_number_sha256 TEXT;

CREATE TABLE IF NOT EXISTS chain_blocks (
  height INTEGER PRIMARY KEY,
  block_hash TEXT NOT NULL UNIQUE,
  prev_hash TEXT NOT NULL,
  merkle_root TEXT NOT NULL,
  tx_count INTEGER NOT NULL DEFAULT 0,
  mined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mined_at_epoch BIGINT NOT NULL DEFAULT 0,
  miner TEXT NOT NULL DEFAULT 'fde-node'
);

CREATE TABLE IF NOT EXISTS chain_transactions (
  tx_hash TEXT PRIMARY KEY,
  block_height INTEGER NOT NULL REFERENCES chain_blocks(height),
  tx_type TEXT NOT NULL,
  cert_id TEXT,
  payload_json JSONB NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chain_tx_block ON chain_transactions(block_height);
CREATE INDEX IF NOT EXISTS idx_chain_tx_cert ON chain_transactions(cert_id);

-- Genesis block (height 0)
INSERT INTO chain_blocks (height, block_hash, prev_hash, merkle_root, tx_count, mined_at, mined_at_epoch, miner)
SELECT 0,
  '0000000000000000000000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000000000000000000000',
  0,
  NOW(),
  0,
  'genesis'
WHERE NOT EXISTS (SELECT 1 FROM chain_blocks WHERE height = 0);
