CREATE TABLE IF NOT EXISTS oauth_device_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES oauth_apps(id) ON DELETE CASCADE,
  device_code_hash TEXT NOT NULL UNIQUE,
  user_code TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  authorized_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  interval_seconds INTEGER NOT NULL DEFAULT 5,
  last_poll_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_device_codes_device_hash ON oauth_device_codes(device_code_hash);
CREATE INDEX IF NOT EXISTS idx_oauth_device_codes_user_code ON oauth_device_codes(user_code);

CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL,
  app_id UUID NOT NULL REFERENCES oauth_apps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  rotated_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  replaced_by_id UUID REFERENCES oauth_refresh_tokens(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_family ON oauth_refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_token_hash ON oauth_refresh_tokens(token_hash);
