-- Guard: never leave unpaid-to-WeChat profit shares without a 7-day hold deadline.
-- Rows already submitted (wx_order_id set / processing / finished) are left alone.

UPDATE profit_share_orders ps
SET
  wx_state = 'held',
  share_after_at = COALESCE(po.paid_at, ps.created_at) + INTERVAL '7 days',
  updated_at = NOW()
FROM payment_orders po
WHERE po.id = ps.payment_order_id
  AND po.status = 'paid'
  AND ps.wx_order_id IS NULL
  AND ps.wx_state IN ('held', 'pending', 'pending_manual', 'failed')
  AND (
    ps.share_after_at IS NULL
    OR ps.wx_state IN ('pending', 'pending_manual', 'failed')
  );
