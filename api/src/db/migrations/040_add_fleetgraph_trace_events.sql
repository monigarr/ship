-- Internal FleetGraph trace event timeline for in-app observability

CREATE TABLE IF NOT EXISTS fleetgraph_trace_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  trace_id TEXT NOT NULL,
  run_id UUID REFERENCES fleetgraph_runs(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_status TEXT NOT NULL,
  latency_ms INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fleetgraph_trace_events_workspace_trace_created
  ON fleetgraph_trace_events(workspace_id, trace_id, created_at ASC);
