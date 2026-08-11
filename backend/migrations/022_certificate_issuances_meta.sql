-- Align certificate_issuances with 005/application layer when 004 created the table first.
-- Without meta_json, author enrollments list aborts the txn (UndefinedColumn) and returns 500.

ALTER TABLE certificate_issuances
  ADD COLUMN IF NOT EXISTS meta_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE certificate_issuances
  ADD COLUMN IF NOT EXISTS camp_id TEXT REFERENCES camps(id);

ALTER TABLE certificate_issuances
  ADD COLUMN IF NOT EXISTS course_title TEXT;

ALTER TABLE certificate_issuances
  ADD COLUMN IF NOT EXISTS cert_id TEXT;

ALTER TABLE certificate_issuances
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'issued';
