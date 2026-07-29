-- 012_author_console.sql — Author console: media library, soft-delete columns, list indexes
-- Idempotent additive migration only.

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  camp_id TEXT NOT NULL REFERENCES camps(id),
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  poster_key TEXT,
  content_type TEXT,
  size_bytes BIGINT,
  duration_sec INTEGER,
  sha256 TEXT,
  tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_camp_kind_created
  ON media_assets (camp_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_assets_camp_deleted
  ON media_assets (camp_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_media_assets_sha256
  ON media_assets (camp_id, sha256) WHERE deleted_at IS NULL;

ALTER TABLE resource_packs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE resource_packs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE learning_resources ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE learning_resources ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_documents_camp_created
  ON documents (camp_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_versions_course_created
  ON course_versions (course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_camp_created
  ON submissions (camp_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrollment_records_offering_user
  ON enrollment_records (offering_id, user_id);
CREATE INDEX IF NOT EXISTS idx_contact_leads_created
  ON contact_leads (created_at DESC);
