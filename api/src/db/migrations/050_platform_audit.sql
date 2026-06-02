CREATE TABLE IF NOT EXISTS platform_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID REFERENCES oauth_apps(id) ON DELETE SET NULL,
  client_id TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  method TEXT NOT NULL,
  route TEXT NOT NULL,
  scope_used TEXT,
  status_code INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_log_app ON platform_audit_log(app_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_log_client ON platform_audit_log(client_id, created_at DESC);
