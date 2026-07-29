-- FDE M1 Domain Model v2 — additive, idempotent migration.
--
-- Introduces a reusable Course / CourseVersion / Offering / Enrollment model on
-- top of the legacy camp-centric schema. Everything here is additive: legacy
-- `camps` + `enrollments (user_id, camp_id)` keep working (dual-read), while new
-- code can move to `courses` -> `course_versions` -> `course_offerings` ->
-- `enrollment_records`.

-- ---------------------------------------------------------------------------
-- Catalog: courses (reusable product) and offerings (a scheduled run)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active|archived|draft
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- course_versions predates this migration (002). Link it to a course so a
-- version becomes "course X, revision N". camp_id stays for dual-read.
ALTER TABLE course_versions ADD COLUMN IF NOT EXISTS course_id TEXT REFERENCES courses(id);

CREATE TABLE IF NOT EXISTS course_offerings (
  id TEXT PRIMARY KEY,
  course_version_id TEXT REFERENCES course_versions(id) ON DELETE SET NULL,
  camp_id TEXT REFERENCES camps(id), -- nullable legacy bridge
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active', -- active|upcoming|ended|archived
  teacher_id TEXT REFERENCES users(id),
  kb_config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_offerings_camp ON course_offerings(camp_id);
CREATE INDEX IF NOT EXISTS idx_offerings_version ON course_offerings(course_version_id);

-- ---------------------------------------------------------------------------
-- Structured curriculum: modules (days) and learning nodes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_modules (
  id TEXT PRIMARY KEY,
  course_version_id TEXT NOT NULL REFERENCES course_versions(id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (course_version_id, day_index)
);

CREATE TABLE IF NOT EXISTS learning_nodes (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
  node_key TEXT NOT NULL,
  kind TEXT NOT NULL, -- learn|quiz|lab|project|review|unlock
  title TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (module_id, node_key)
);

-- ---------------------------------------------------------------------------
-- Enrollment v2: a user enrolled into a specific offering
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enrollment_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offering_id TEXT NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active', -- active|completed|dropped
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, offering_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollment_records_user ON enrollment_records(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_records_offering ON enrollment_records(offering_id);

-- Dual-read bridge: tag existing per-learner rows with an enrollment when known.
ALTER TABLE node_progress    ADD COLUMN IF NOT EXISTS enrollment_id TEXT REFERENCES enrollment_records(id);
ALTER TABLE evidence         ADD COLUMN IF NOT EXISTS enrollment_id TEXT REFERENCES enrollment_records(id);
ALTER TABLE quiz_attempts    ADD COLUMN IF NOT EXISTS enrollment_id TEXT REFERENCES enrollment_records(id);
ALTER TABLE submissions      ADD COLUMN IF NOT EXISTS enrollment_id TEXT REFERENCES enrollment_records(id);
ALTER TABLE workspace_heads  ADD COLUMN IF NOT EXISTS enrollment_id TEXT REFERENCES enrollment_records(id);
CREATE INDEX IF NOT EXISTS idx_node_progress_enrollment ON node_progress(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_evidence_enrollment ON evidence(enrollment_id);

-- Session remembers the learner's currently-active enrollment.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS active_enrollment_id TEXT REFERENCES enrollment_records(id);

-- ---------------------------------------------------------------------------
-- Rubrics
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rubric_definitions (
  id TEXT PRIMARY KEY,
  course_version_id TEXT REFERENCES course_versions(id) ON DELETE CASCADE,
  node_key TEXT,
  title TEXT NOT NULL,
  runner TEXT, -- agent|sim|manual
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rubric_criteria (
  id TEXT PRIMARY KEY,
  rubric_id TEXT NOT NULL REFERENCES rubric_definitions(id) ON DELETE CASCADE,
  check_id TEXT NOT NULL,
  args_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  weight DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_rubric_criteria_rubric ON rubric_criteria(rubric_id);

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_key TEXT,
  bio TEXT,
  contact_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS identity_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method TEXT NOT NULL, -- email|phone|realname|manual
  status TEXT NOT NULL DEFAULT 'pending', -- pending|verified|rejected
  detail_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_identity_verifications_user ON identity_verifications(user_id);

-- ---------------------------------------------------------------------------
-- Certificates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS certificate_templates (
  id TEXT PRIMARY KEY,
  course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  body_template TEXT,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS certificate_issuances (
  id TEXT PRIMARY KEY,
  template_id TEXT REFERENCES certificate_templates(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrollment_id TEXT REFERENCES enrollment_records(id) ON DELETE SET NULL,
  serial TEXT NOT NULL UNIQUE,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cert_issuances_user ON certificate_issuances(user_id);

-- ---------------------------------------------------------------------------
-- Learning resources
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resource_packs (
  id TEXT PRIMARY KEY,
  course_version_id TEXT REFERENCES course_versions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learning_resources (
  id TEXT PRIMARY KEY,
  pack_id TEXT REFERENCES resource_packs(id) ON DELETE CASCADE,
  course_version_id TEXT REFERENCES course_versions(id) ON DELETE CASCADE,
  day_index INTEGER,
  kind TEXT NOT NULL, -- doc|video|link|dataset|template
  title TEXT NOT NULL,
  object_key TEXT,
  url TEXT,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_learning_resources_pack ON learning_resources(pack_id);
CREATE INDEX IF NOT EXISTS idx_learning_resources_version ON learning_resources(course_version_id);

CREATE TABLE IF NOT EXISTS submission_attachments (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL,
  filename TEXT,
  content_type TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_submission_attachments_sub ON submission_attachments(submission_id);

-- ---------------------------------------------------------------------------
-- Site / landing (M2)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS site_pages (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft|published
  body_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_media (
  id TEXT PRIMARY KEY,
  page_id TEXT REFERENCES site_pages(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'image', -- image|video|file
  object_key TEXT NOT NULL,
  alt TEXT,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES ('004_domain_v2')
ON CONFLICT (version) DO NOTHING;
