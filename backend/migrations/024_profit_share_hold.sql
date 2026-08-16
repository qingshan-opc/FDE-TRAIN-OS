-- 7-day WeChat profit-share hold: freeze until share_after_at, then split.
-- Refunds within the window come from frozen funds; after share, refunds are blocked.

ALTER TABLE profit_share_orders
  ADD COLUMN IF NOT EXISTS share_after_at TIMESTAMPTZ;

ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_fen INTEGER,
  ADD COLUMN IF NOT EXISTS out_refund_no TEXT,
  ADD COLUMN IF NOT EXISTS wx_refund_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profit_share_due
  ON profit_share_orders (wx_state, share_after_at);

ALTER TABLE profit_share_orders DROP CONSTRAINT IF EXISTS profit_share_orders_beneficiary_kind_check;
ALTER TABLE profit_share_orders ADD CONSTRAINT profit_share_orders_beneficiary_kind_check
  CHECK (beneficiary_kind IN ('org', 'learner', 'platform'));

-- Orders that never reached WeChat wait until paid_at + 7 days (due immediately if already older).
UPDATE profit_share_orders ps
SET
  wx_state = 'held',
  share_after_at = COALESCE(po.paid_at, ps.created_at) + INTERVAL '7 days'
FROM payment_orders po
WHERE po.id = ps.payment_order_id
  AND ps.wx_order_id IS NULL
  AND ps.wx_state IN ('pending', 'pending_manual', 'failed')
  AND po.status = 'paid';

-- Already submitted to WeChat: keep state, mark due so retry can continue.
UPDATE profit_share_orders ps
SET share_after_at = COALESCE(ps.share_after_at, ps.created_at)
FROM payment_orders po
WHERE po.id = ps.payment_order_id
  AND ps.share_after_at IS NULL
  AND ps.wx_state IN ('pending', 'pending_manual', 'failed', 'processing');
