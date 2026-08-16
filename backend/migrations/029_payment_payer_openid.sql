-- JSAPI payer identity is the WeChat currently holding the phone, not the
-- login account's bound openid. Persist it so pending prepay_id reuse cannot
-- mix two WeChat users (「下单账号与支付账号不一致」).
ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS wx_payer_openid TEXT;

CREATE INDEX IF NOT EXISTS idx_payment_orders_pending_payer
  ON payment_orders (user_id, offering_id, status, wx_payer_openid);

-- Distinguish poster-login OAuth states from silent JSAPI-openid states.
ALTER TABLE wechat_login_states
  ADD COLUMN IF NOT EXISTS purpose TEXT;

UPDATE wechat_login_states SET purpose = 'login' WHERE purpose IS NULL;
