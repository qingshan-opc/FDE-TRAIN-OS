-- WeChat MP scan-to-follow login identity
ALTER TABLE users ADD COLUMN IF NOT EXISTS wx_mp_openid TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wx_nickname TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wx_mp_openid
  ON users (wx_mp_openid) WHERE wx_mp_openid IS NOT NULL;

CREATE TABLE IF NOT EXISTS wechat_login_states (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  user_id TEXT,
  ticket TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_wechat_login_states_exp ON wechat_login_states(expires_at);

-- Backfill: one partner user per receiver openid (openid is unique on users)
UPDATE users u
SET wx_mp_openid = x.wx_receiver_account
FROM (
  SELECT DISTINCT ON (o.wx_receiver_account)
    u2.id AS user_id,
    o.wx_receiver_account
  FROM organizations o
  JOIN org_accounts oa ON oa.org_id = o.id AND oa.status = 'active'
  JOIN users u2 ON LOWER(u2.email) = LOWER(oa.email)
  WHERE o.wx_receiver_type = 'PERSONAL_OPENID'
    AND o.wx_receiver_account IS NOT NULL
    AND u2.role IN ('partner', 'admin')
    AND u2.wx_mp_openid IS NULL
  ORDER BY o.wx_receiver_account, oa.created_at ASC NULLS LAST, u2.id
) x
WHERE u.id = x.user_id
  AND u.wx_mp_openid IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM users u3 WHERE u3.wx_mp_openid = x.wx_receiver_account
  );
