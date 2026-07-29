-- Partner attribution + WeChat billing + profit sharing

ALTER TABLE course_offerings ADD COLUMN IF NOT EXISTS price_fen INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  contact_name TEXT,
  contact_email TEXT,
  wx_receiver_type TEXT,
  wx_receiver_account TEXT,
  wx_receiver_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_accounts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_org_accounts_org ON org_accounts(org_id);

CREATE TABLE IF NOT EXISTS invite_codes (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  offering_id TEXT REFERENCES course_offerings(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invite_codes_org ON invite_codes(org_id);

CREATE TABLE IF NOT EXISTS user_attributions (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  invite_code_id TEXT REFERENCES invite_codes(id),
  bound_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_attributions_org ON user_attributions(org_id);

CREATE TABLE IF NOT EXISTS commission_tiers (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  min_paid_users INTEGER NOT NULL DEFAULT 0,
  rate_bps INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, min_paid_users),
  CHECK (rate_bps >= 0 AND rate_bps <= 3000)
);
CREATE INDEX IF NOT EXISTS idx_commission_tiers_org ON commission_tiers(org_id);

CREATE TABLE IF NOT EXISTS payment_orders (
  id TEXT PRIMARY KEY,
  out_trade_no TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  offering_id TEXT NOT NULL REFERENCES course_offerings(id),
  org_id TEXT REFERENCES organizations(id),
  amount_fen INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  code_url TEXT,
  wx_transaction_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_org ON payment_orders(org_id);

CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT,
  payload_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, event_id)
);

CREATE TABLE IF NOT EXISTS profit_share_orders (
  id TEXT PRIMARY KEY,
  payment_order_id TEXT NOT NULL REFERENCES payment_orders(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  rate_bps INTEGER NOT NULL,
  share_fen INTEGER NOT NULL,
  wx_state TEXT NOT NULL DEFAULT 'pending',
  wx_order_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profit_share_payment ON profit_share_orders(payment_order_id);

ALTER TABLE enrollment_records ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE enrollment_records ADD COLUMN IF NOT EXISTS invite_redemption_id TEXT;

-- Migrate legacy camp invite code into system org (idempotent)
INSERT INTO organizations (id, name, status)
SELECT 'org-platform', '平台默认渠道', 'active'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE id = 'org-platform');

INSERT INTO invite_codes (id, org_id, code, status, used_count)
SELECT 'invite-fde-demo', 'org-platform', c.invite_code, 'active', 0
FROM camps c
WHERE c.invite_code IS NOT NULL AND c.invite_code <> ''
  AND NOT EXISTS (SELECT 1 FROM invite_codes WHERE code = c.invite_code)
LIMIT 1;

-- Default demo offering price (1 CNY for dev testing)
UPDATE course_offerings SET price_fen = 100 WHERE price_fen = 0 OR price_fen IS NULL;
