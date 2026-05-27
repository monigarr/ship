-- FleetGraph traces are internal Ship observability records. Older demo rows may
-- contain LangSmith share URLs; rewrite those persisted links to the in-app trace
-- detail route so production trace tables never navigate away from Ship.
UPDATE fleetgraph_runs
SET trace_url = '/fleetgraph/traces/' || trace_id
WHERE trace_id IS NOT NULL
  AND btrim(trace_id) <> ''
  AND (
    trace_url ~* '^https?://smith\.langchain\.com(/|$)'
    OR trace_url LIKE 'internal://fleetgraph/%'
  );
