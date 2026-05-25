-- FleetGraph runtime persistence for runs, findings, and HITL decisions

CREATE TABLE IF NOT EXISTS fleetgraph_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  trigger TEXT NOT NULL,
  branch TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  trace_url TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  token_estimate INTEGER NOT NULL DEFAULT 0,
  cost_estimate_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  run_input JSONB NOT NULL DEFAULT '{}'::jsonb,
  run_output JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fleetgraph_runs_workspace_created
  ON fleetgraph_runs(workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS fleetgraph_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES fleetgraph_runs(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  confidence NUMERIC(4, 3) NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  dedupe_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_fleetgraph_findings_workspace_status_updated
  ON fleetgraph_findings(workspace_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS fleetgraph_hitl_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  finding_id UUID NOT NULL REFERENCES fleetgraph_findings(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision_status TEXT NOT NULL DEFAULT 'pending',
  decision_by UUID REFERENCES users(id) ON DELETE SET NULL,
  decision_note TEXT,
  decision_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fleetgraph_hitl_workspace_status
  ON fleetgraph_hitl_requests(workspace_id, decision_status, created_at DESC);
