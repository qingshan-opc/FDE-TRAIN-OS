-- M2 learner IA: public site content, profile, identity, certificates (idempotent additive)

CREATE TABLE IF NOT EXISTS site_pages (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  tagline TEXT,
  cta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_media (
  id TEXT PRIMARY KEY,
  page_slug TEXT NOT NULL REFERENCES site_pages(slug) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'hero_video', -- hero_video|hero_image|...
  poster_url TEXT,
  src_url TEXT,
  captions_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS identity_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'stub',
  verification_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|verified|rejected
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS certificate_templates (
  id TEXT PRIMARY KEY,
  camp_id TEXT REFERENCES camps(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS certificate_issuances (
  id TEXT PRIMARY KEY,
  cert_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  camp_id TEXT REFERENCES camps(id),
  template_id TEXT REFERENCES certificate_templates(id),
  course_title TEXT,
  status TEXT NOT NULL DEFAULT 'issued', -- issued|revoked
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_identity_verifications_user ON identity_verifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_certificate_issuances_user ON certificate_issuances(user_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_media_page ON site_media(page_slug, kind);

-- NOTE: the `landing` seed row is inserted lazily by
-- `services/learner/app.py` (`_ensure_landing_row`) on first read, not here.
-- `site_pages` / `site_media` / `user_profiles` / `identity_verifications` /
-- `certificate_templates` / `certificate_issuances` are also declared by the
-- M1 domain migration (`004_domain_v2.sql`) with a different column set —
-- CREATE TABLE IF NOT EXISTS above is a no-op when that migration created
-- them first, and `services/learner/app.py` reads/writes defensively
-- (`SELECT *` + alias fallbacks, multi-variant INSERT) so it works either way.

INSERT INTO schema_migrations (version) VALUES ('005_site_and_identity')
ON CONFLICT (version) DO NOTHING;
