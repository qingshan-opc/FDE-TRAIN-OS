-- Short-lived WeChat OAuth state for partner receiver bind (avoid long JWT in QR URL)
CREATE TABLE IF NOT EXISTS wechat_oauth_states (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'wx_bind',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_wechat_oauth_states_exp ON wechat_oauth_states(expires_at);
