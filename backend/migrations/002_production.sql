-- FDE production schema (idempotent additive migration)

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  camp_id TEXT REFERENCES camps(id),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  ip TEXT
);

CREATE TABLE IF NOT EXISTS course_versions (
  id TEXT PRIMARY KEY,
  camp_id TEXT NOT NULL REFERENCES camps(id) ON DELETE CASCADE,
  version_tag TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft|published|archived
  title TEXT NOT NULL,
  source TEXT,
  published_at TIMESTAMPTZ,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (camp_id, version_tag)
);

CREATE TABLE IF NOT EXISTS day_packages (
  id TEXT PRIMARY KEY,
  course_version_id TEXT NOT NULL REFERENCES course_versions(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  title TEXT NOT NULL,
  project TEXT,
  package_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_version_id, day)
);

CREATE TABLE IF NOT EXISTS capsule_progress (
  learner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  camp_id TEXT NOT NULL REFERENCES camps(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  capsule_id TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (learner_id, camp_id, day, capsule_id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL, -- agent_job|document_ingest|preview_build
  status TEXT NOT NULL DEFAULT 'queued',
  camp_id TEXT REFERENCES camps(id),
  learner_id TEXT REFERENCES users(id),
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  locked_by TEXT,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_events (
  id BIGSERIAL PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_leases (
  job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL,
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  response_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS workspace_heads (
  camp_id TEXT NOT NULL,
  learner_id TEXT NOT NULL,
  snapshot_id TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (camp_id, learner_id)
);

CREATE TABLE IF NOT EXISTS workspace_snapshots (
  id TEXT PRIMARY KEY,
  camp_id TEXT NOT NULL,
  learner_id TEXT NOT NULL,
  parent_id TEXT,
  manifest_key TEXT NOT NULL,
  object_prefix TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  file_count INTEGER NOT NULL DEFAULT 0,
  created_by_job_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  camp_id TEXT NOT NULL,
  learner_id TEXT NOT NULL,
  submission_id TEXT,
  object_key TEXT NOT NULL,
  content_type TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  sha256 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  camp_id TEXT NOT NULL REFERENCES camps(id),
  learner_id TEXT NOT NULL REFERENCES users(id),
  day INTEGER NOT NULL,
  node_id TEXT NOT NULL,
  job_id TEXT,
  snapshot_id TEXT,
  artifact_id TEXT,
  eval_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (learner_id, camp_id, day, node_id, job_id)
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  camp_id TEXT NOT NULL REFERENCES camps(id),
  uploaded_by TEXT REFERENCES users(id),
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  sha256 TEXT NOT NULL,
  object_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploading',
  scan_status TEXT,
  lingzhi_file_id TEXT,
  lingzhi_knowledge_id TEXT,
  lingzhi_job_id TEXT,
  parser_version TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_bindings (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  course_version_id TEXT REFERENCES course_versions(id),
  day INTEGER,
  capsule_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingest_jobs (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS publish_events (
  id TEXT PRIMARY KEY,
  course_version_id TEXT NOT NULL REFERENCES course_versions(id),
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  camp_id TEXT,
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sim_sessions (
  id TEXT PRIMARY KEY,
  sim_kind TEXT NOT NULL,
  learner_id TEXT REFERENCES users(id),
  camp_id TEXT REFERENCES camps(id),
  day INTEGER,
  state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- harden existing tables
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS payload_jsonb JSONB;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS capability_tags_jsonb JSONB;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS answers_jsonb JSONB;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS passed BOOLEAN;
ALTER TABLE camps ADD COLUMN IF NOT EXISTS lingzhi_source_id TEXT;
ALTER TABLE camps ADD COLUMN IF NOT EXISTS lingzhi_client_token_ref TEXT;
ALTER TABLE agent_jobs ADD COLUMN IF NOT EXISTS workspace_snapshot_id TEXT;
ALTER TABLE agent_jobs ADD COLUMN IF NOT EXISTS queue_job_id TEXT;

CREATE INDEX IF NOT EXISTS idx_evidence_lookup
  ON evidence (learner_id, day, node_id, kind);

CREATE INDEX IF NOT EXISTS idx_jobs_status_locked ON jobs(status, locked_until);
CREATE INDEX IF NOT EXISTS idx_job_events_job ON job_events(job_id, id);
CREATE INDEX IF NOT EXISTS idx_documents_camp_status ON documents(camp_id, status);
CREATE INDEX IF NOT EXISTS idx_submissions_learner ON submissions(learner_id, camp_id, day);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id) WHERE revoked_at IS NULL;

INSERT INTO schema_migrations (version) VALUES ('002_production')
ON CONFLICT (version) DO NOTHING;
