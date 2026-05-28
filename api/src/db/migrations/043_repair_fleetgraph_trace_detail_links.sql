-- Repair legacy FleetGraph observability rows so every trace index entry opens
-- an internal Ship trace detail page instead of linking back to the trace index.

UPDATE fleetgraph_runs
SET trace_id = id::text
WHERE trace_id IS NULL
   OR btrim(trace_id) = '';

UPDATE fleetgraph_runs
SET trace_url = '/fleetgraph/traces/' || trace_id
WHERE trace_id IS NOT NULL
  AND btrim(trace_id) <> ''
  AND (
    trace_url IS NULL
    OR btrim(trace_url) = ''
    OR trace_url IN ('/fleetgraph/traces', '/fleetgraph/traces/')
    OR trace_url ~* '^https?://'
    OR trace_url LIKE 'internal://fleetgraph/%'
  );

UPDATE fleetgraph_trace_events e
SET trace_id = r.trace_id
FROM fleetgraph_runs r
WHERE e.run_id = r.id
  AND (e.trace_id IS NULL OR btrim(e.trace_id) = '')
  AND r.trace_id IS NOT NULL
  AND btrim(r.trace_id) <> '';
