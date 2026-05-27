-- FleetGraph traces are internal Ship observability records. Rewrite older
-- external share URLs to the in-app trace detail route so production trace
-- tables never navigate away from Ship.
UPDATE fleetgraph_runs
SET trace_url = '/fleetgraph/traces/' || trace_id
WHERE trace_id IS NOT NULL
  AND btrim(trace_id) <> ''
  AND (
    trace_url ~* '^https?://'
    OR trace_url LIKE 'internal://fleetgraph/%'
  );
