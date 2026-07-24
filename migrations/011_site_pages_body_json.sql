-- Ensure landing body_json exists for open_courses admin overrides (works
-- whether 004 or 005 created site_pages first).

ALTER TABLE site_pages
  ADD COLUMN IF NOT EXISTS body_json JSONB NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO schema_migrations (version) VALUES ('011_site_pages_body_json')
ON CONFLICT (version) DO NOTHING;
