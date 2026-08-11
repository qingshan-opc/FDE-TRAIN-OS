-- Alipay dual-channel billing: track payment provider per order.
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS pay_channel TEXT NOT NULL DEFAULT 'wechat';
CREATE INDEX IF NOT EXISTS idx_payment_orders_channel ON payment_orders(pay_channel);
