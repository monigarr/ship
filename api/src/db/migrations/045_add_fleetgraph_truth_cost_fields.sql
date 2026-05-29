-- Persist truth-based FleetGraph token and spend metadata.

ALTER TABLE fleetgraph_runs
  ADD COLUMN IF NOT EXISTS model_id TEXT,
  ADD COLUMN IF NOT EXISTS token_source TEXT NOT NULL DEFAULT 'heuristic_estimate',
  ADD COLUMN IF NOT EXISTS runtime_spend_usd NUMERIC(10, 6),
  ADD COLUMN IF NOT EXISTS billed_spend_usd NUMERIC(10, 6);

-- Backfill existing rows so diagnostics have a consistent runtime spend basis.
UPDATE fleetgraph_runs
SET runtime_spend_usd = cost_estimate_usd
WHERE runtime_spend_usd IS NULL;

UPDATE fleetgraph_runs
SET token_source = CASE
  WHEN token_source IS NULL OR btrim(token_source) = '' THEN 'heuristic_estimate'
  WHEN token_source IN ('actual_model_usage', 'heuristic_estimate') THEN token_source
  ELSE 'heuristic_estimate'
END;

CREATE INDEX IF NOT EXISTS idx_fleetgraph_runs_workspace_created_at
  ON fleetgraph_runs(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fleetgraph_runs_workspace_model_id
  ON fleetgraph_runs(workspace_id, model_id)
  WHERE model_id IS NOT NULL;
