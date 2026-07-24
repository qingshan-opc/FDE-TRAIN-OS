-- M4: unified LabRuntime — SQL sandbox sessions + learner lab attachments.
-- (Runs against the platform DB via services/migrations_runner. The actual
--  sandbox data lives in a separate `fde_sandbox` database, provisioned at
--  runtime by services/lab_runtime/sql_sandbox.py — not by this migration.)

CREATE TABLE IF NOT EXISTS sql_lab_sessions (
  id TEXT PRIMARY KEY,
  learner_id TEXT REFERENCES users(id),
  camp_id TEXT REFERENCES camps(id),
  day INTEGER,
  node_id TEXT,
  schema_name TEXT NOT NULL,
  role_name TEXT NOT NULL,
  role_password TEXT NOT NULL,
  seed_sql_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sql_lab_sessions_learner ON sql_lab_sessions(learner_id, camp_id, day);
CREATE INDEX IF NOT EXISTS idx_sql_lab_sessions_expires ON sql_lab_sessions(expires_at);

-- Learner-uploaded lab attachments (screenshots, exports, notebooks, ...).
-- Distinct from `submission_attachments` (004) because a learner may attach
-- evidence to an in-progress attempt *before* a `submissions` row exists.
-- `rag_eligible` defaults to FALSE — learner uploads are never auto-ingested
-- into the knowledge base unless an author explicitly opts a specific
-- attachment in.
CREATE TABLE IF NOT EXISTS lab_attachments (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  camp_id TEXT REFERENCES camps(id),
  day INTEGER,
  node_id TEXT,
  attempt_id TEXT,
  submission_id TEXT REFERENCES submissions(id) ON DELETE SET NULL,
  object_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  sha256 TEXT,
  scan_status TEXT NOT NULL DEFAULT 'pending',
  rag_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lab_attachments_learner ON lab_attachments(learner_id, camp_id, day, node_id);
CREATE INDEX IF NOT EXISTS idx_lab_attachments_attempt ON lab_attachments(attempt_id);
CREATE INDEX IF NOT EXISTS idx_lab_attachments_submission ON lab_attachments(submission_id);

INSERT INTO schema_migrations (version) VALUES ('006_sql_lab')
ON CONFLICT (version) DO NOTHING;
