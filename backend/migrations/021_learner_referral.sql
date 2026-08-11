-- Learner referral: user-level invite codes, attributions, checkout referrer, profit share

CREATE TABLE IF NOT EXISTS learner_invite_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  used_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_learner_invite_codes_code ON learner_invite_codes(code);

CREATE TABLE IF NOT EXISTS user_referrals (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  referrer_user_id TEXT NOT NULL REFERENCES users(id),
  invite_code_id TEXT REFERENCES learner_invite_codes(id),
  bound_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_referrals_referrer ON user_referrals(referrer_user_id);

ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS referrer_user_id TEXT REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_referrer ON payment_orders(referrer_user_id);

ALTER TABLE profit_share_orders ALTER COLUMN org_id DROP NOT NULL;
ALTER TABLE profit_share_orders ADD COLUMN IF NOT EXISTS referrer_user_id TEXT REFERENCES users(id);
ALTER TABLE profit_share_orders ADD COLUMN IF NOT EXISTS beneficiary_kind TEXT NOT NULL DEFAULT 'org';
ALTER TABLE profit_share_orders DROP CONSTRAINT IF EXISTS profit_share_orders_beneficiary_kind_check;
ALTER TABLE profit_share_orders ADD CONSTRAINT profit_share_orders_beneficiary_kind_check
  CHECK (beneficiary_kind IN ('org', 'learner'));
CREATE INDEX IF NOT EXISTS idx_profit_share_referrer ON profit_share_orders(referrer_user_id);

-- One profit-share row per payment order (prevents concurrent double share)
CREATE UNIQUE INDEX IF NOT EXISTS uq_profit_share_payment_order
  ON profit_share_orders(payment_order_id);
