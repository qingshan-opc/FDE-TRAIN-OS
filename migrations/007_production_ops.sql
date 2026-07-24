-- M6 production ops — additive, idempotent migration.
--
-- Adds the columns needed for the real KYC adapter + certificate issuance
-- lifecycle. `identity_verifications` and `certificate_issuances` were
-- declared with two different (but overlapping) column shapes by
-- `004_domain_v2.sql` and `005_site_and_identity.sql` — whichever ran first
-- on a given database "won" the CREATE TABLE. Every statement below is a
-- plain `ADD COLUMN IF NOT EXISTS` so it is safe against either shape.

-- ---------------------------------------------------------------------------
-- Identity verifications: never store raw ID numbers / face images — only
-- the provider's opaque reference + masked display fields.
-- ---------------------------------------------------------------------------
ALTER TABLE identity_verifications ADD COLUMN IF NOT EXISTS provider_ref TEXT;
ALTER TABLE identity_verifications ADD COLUMN IF NOT EXISTS masked_name TEXT;
ALTER TABLE identity_verifications ADD COLUMN IF NOT EXISTS id_tail TEXT;
CREATE INDEX IF NOT EXISTS idx_identity_verifications_provider_ref ON identity_verifications(provider_ref);

-- ---------------------------------------------------------------------------
-- Certificate issuances: immutable issuance row + revoke fields + evidence
-- snapshot used at issuance time (completion rate / rubric gate / mentor
-- review), so a later dispute can be resolved without recomputing history.
-- ---------------------------------------------------------------------------
ALTER TABLE certificate_issuances ADD COLUMN IF NOT EXISTS cert_id TEXT;
ALTER TABLE certificate_issuances ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'issued';
ALTER TABLE certificate_issuances ADD COLUMN IF NOT EXISTS enrollment_id TEXT REFERENCES enrollment_records(id) ON DELETE SET NULL;
ALTER TABLE certificate_issuances ADD COLUMN IF NOT EXISTS qr_payload JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE certificate_issuances ADD COLUMN IF NOT EXISTS pdf_object_key TEXT;
ALTER TABLE certificate_issuances ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE certificate_issuances ADD COLUMN IF NOT EXISTS revoke_reason TEXT;
ALTER TABLE certificate_issuances ADD COLUMN IF NOT EXISTS completion_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE certificate_issuances ADD COLUMN IF NOT EXISTS issued_by TEXT REFERENCES users(id);

-- Backfill cert_id from the legacy `serial` column when that shape exists
-- (004's shape). No-op when the column doesn't exist on this DB's table.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='certificate_issuances' AND column_name='serial'
  ) THEN
    EXECUTE 'UPDATE certificate_issuances SET cert_id = serial WHERE cert_id IS NULL';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_certificate_issuances_cert_id
  ON certificate_issuances(cert_id) WHERE cert_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_certificate_issuances_enrollment ON certificate_issuances(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_certificate_issuances_status ON certificate_issuances(status);

INSERT INTO schema_migrations (version) VALUES ('007_production_ops')
ON CONFLICT (version) DO NOTHING;
