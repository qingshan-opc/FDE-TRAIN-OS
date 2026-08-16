-- One-time partner activation codes (author issues → WeChat user redeems → new org).

CREATE TABLE IF NOT EXISTS partner_activation_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_by TEXT REFERENCES users(id),
  used_by TEXT REFERENCES users(id),
  used_at TIMESTAMPTZ,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_activation_status
  ON partner_activation_codes (status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_activation_code_upper
  ON partner_activation_codes (UPPER(code));
