-- Per-learner study time aggregated by training day (not calendar date).

CREATE TABLE IF NOT EXISTS learning_daily_stats (
  learner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  camp_id TEXT NOT NULL,
  day INTEGER NOT NULL,
  study_seconds INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (learner_id, camp_id, day)
);
CREATE INDEX IF NOT EXISTS idx_learning_daily_stats_camp ON learning_daily_stats(camp_id, day);

INSERT INTO schema_migrations (version) VALUES ('013_learning_daily_stats')
ON CONFLICT (version) DO NOTHING;
