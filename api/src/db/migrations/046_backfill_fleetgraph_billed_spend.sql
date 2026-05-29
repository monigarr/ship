-- Backfill billed spend for rows already marked as provider-token-backed.

UPDATE fleetgraph_runs
SET billed_spend_usd = COALESCE(billed_spend_usd, runtime_spend_usd, cost_estimate_usd)
WHERE token_source = 'actual_model_usage'
  AND billed_spend_usd IS NULL;
