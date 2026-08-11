-- WeChat bind challenges (email users must bind OA) + password reset via MP OTP

CREATE TABLE IF NOT EXISTS wechat_bind_challenges (
  id TEXT PRIMARY KEY,
  scene TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending_scan', -- pending_scan|bound|expired
  openid TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bound_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wechat_bind_challenges_user
  ON wechat_bind_challenges(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS password_reset_challenges (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  scene TEXT NOT NULL UNIQUE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  code_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending_scan', -- pending_scan|code_sent|used|expired
  openid TEXT,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_password_reset_challenges_email
  ON password_reset_challenges(email, created_at DESC);

INSERT INTO schema_migrations (version) VALUES ('020_wechat_bind_password_reset')
ON CONFLICT (version) DO NOTHING;
