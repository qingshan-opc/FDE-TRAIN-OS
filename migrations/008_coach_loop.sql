-- M5: AI learning loop — persisted coach turns (scoped Q&A + citations) and
-- mentor-review handoff requests for the diagnose -> AI feedback -> retry ->
-- human review loop.

CREATE TABLE IF NOT EXISTS coach_turns (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT REFERENCES enrollment_records(id) ON DELETE SET NULL,
  learner_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  camp_id TEXT REFERENCES camps(id),
  day INTEGER,
  node_id TEXT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL DEFAULT '',
  citations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  model TEXT,
  prompt_version TEXT,
  eval_version TEXT,
  job_id TEXT,
  submission_id TEXT REFERENCES submissions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coach_turns_learner ON coach_turns(learner_id, camp_id, day, node_id);
CREATE INDEX IF NOT EXISTS idx_coach_turns_enrollment ON coach_turns(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_coach_turns_submission ON coach_turns(submission_id);

-- Human-in-the-loop review requests, created by the learner via
-- `/api/v1/coach/handoff` when the AI coach loop can't resolve a repeated
-- failure; resolved by an author/admin via `/api/v1/author/reviews`.
CREATE TABLE IF NOT EXISTS mentor_reviews (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  camp_id TEXT REFERENCES camps(id),
  enrollment_id TEXT REFERENCES enrollment_records(id) ON DELETE SET NULL,
  day INTEGER,
  node_id TEXT,
  submission_id TEXT REFERENCES submissions(id) ON DELETE SET NULL,
  coach_turn_id TEXT REFERENCES coach_turns(id) ON DELETE SET NULL,
  reason TEXT NOT NULL DEFAULT '',
  diagnostics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  mentor_id TEXT REFERENCES users(id),
  mentor_feedback TEXT,
  mentor_score DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_mentor_reviews_status ON mentor_reviews(status, created_at);
CREATE INDEX IF NOT EXISTS idx_mentor_reviews_learner ON mentor_reviews(learner_id, camp_id);
CREATE INDEX IF NOT EXISTS idx_mentor_reviews_submission ON mentor_reviews(submission_id);

INSERT INTO schema_migrations (version) VALUES ('008_coach_loop')
ON CONFLICT (version) DO NOTHING;
