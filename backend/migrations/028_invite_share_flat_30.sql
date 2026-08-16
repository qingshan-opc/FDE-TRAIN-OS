-- Invite-link profit share is a flat 30%.
-- Bump leftover 20% base tiers that were the org's only tier
-- (activation default before this change). Custom multi-tier ladders stay.

UPDATE commission_tiers t
SET rate_bps = 3000
WHERE t.min_paid_users = 0
  AND t.rate_bps = 2000
  AND NOT EXISTS (
    SELECT 1 FROM commission_tiers o
    WHERE o.org_id = t.org_id AND o.id <> t.id
  );
