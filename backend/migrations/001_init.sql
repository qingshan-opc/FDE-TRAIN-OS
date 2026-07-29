-- FDE 0.1 initial schema (Postgres)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'learner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS camps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'v0.3',
  invite_code TEXT,
  lingzhi_api_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enrollments (
  user_id TEXT NOT NULL,
  camp_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, camp_id)
);

CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  learner_id TEXT NOT NULL,
  camp_version TEXT,
  day INTEGER,
  node_id TEXT,
  kind TEXT,
  payload_json TEXT,
  capability_tags TEXT
);

CREATE TABLE IF NOT EXISTS agent_jobs (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL,
  camp_id TEXT NOT NULL,
  workspace TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL,
  runner TEXT NOT NULL,
  anycode_session_id TEXT,
  anycode_project_id TEXT,
  events_json TEXT,
  result_json TEXT,
  artifact_uri TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS node_progress (
  learner_id TEXT NOT NULL,
  camp_id TEXT NOT NULL,
  day INTEGER NOT NULL,
  node_id TEXT NOT NULL,
  status TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (learner_id, camp_id, day, node_id)
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL,
  camp_id TEXT NOT NULL,
  day INTEGER NOT NULL,
  node_id TEXT NOT NULL,
  score DOUBLE PRECISION,
  pass INTEGER,
  answers_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_learner ON evidence(learner_id);
CREATE INDEX IF NOT EXISTS idx_jobs_learner ON agent_jobs(learner_id);
