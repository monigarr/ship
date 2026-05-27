-- FleetGraph trace links must stay inside Ship. Re-run the external URL repair
-- as a new migration so deployments that already applied migration 041 still
-- receive the production data fix.
UPDATE fleetgraph_runs
SET trace_url = '/fleetgraph/traces/' || trace_id
WHERE trace_id IS NOT NULL
  AND btrim(trace_id) <> ''
  AND (
    trace_url ~* '^https?://'
    OR trace_url LIKE 'internal://fleetgraph/%'
  );
