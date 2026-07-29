-- M7: per-capsule practice responses — persisted draft/submitted answers so
-- a learner's practice text survives a refresh, and `learn` node completion
-- can require submission (not just "opened") when a capsule marks
-- `practice.required: true`.

CREATE TABLE IF NOT EXISTS practice_responses (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  camp_id TEXT NOT NULL,
  day INTEGER NOT NULL,
  capsule_id TEXT NOT NULL,
  response_text TEXT NOT NULL DEFAULT '',
  response_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft', -- draft|submitted
  submitted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (learner_id, camp_id, day, capsule_id)
);
CREATE INDEX IF NOT EXISTS idx_practice_learner_day ON practice_responses(learner_id, camp_id, day);

INSERT INTO schema_migrations (version) VALUES ('010_practice_responses')
ON CONFLICT (version) DO NOTHING;
