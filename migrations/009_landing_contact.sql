-- M2 landing IA: enterprise/institution training inquiries from the public
-- 「联系我们」 tab (idempotent additive). Written by
-- `POST /api/v1/site/contact` in `services/learner/app.py`; always also
-- mirrored into `audit_logs` so a lead is never silently dropped even if
-- this migration hasn't run yet in a given environment.

CREATE TABLE IF NOT EXISTS contact_leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  org TEXT,
  email TEXT,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_leads_created ON contact_leads(created_at DESC);

INSERT INTO schema_migrations (version) VALUES ('009_landing_contact')
ON CONFLICT (version) DO NOTHING;
