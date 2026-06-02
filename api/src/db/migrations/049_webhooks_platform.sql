CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES oauth_apps(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  target_url TEXT NOT NULL,
  signing_secret TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_app_event ON webhook_subscriptions(app_id, event_type) WHERE active = TRUE;

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'dead_letter')),
  response_status INTEGER,
  response_excerpt TEXT,
  latency_ms INTEGER,
  next_retry_at TIMESTAMPTZ,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_subscription ON webhook_deliveries(subscription_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status) WHERE status IN ('pending', 'dead_letter');
