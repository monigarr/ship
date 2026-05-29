-- Add optional external trace URL storage (e.g., LangSmith) while preserving internal trace_url.

ALTER TABLE fleetgraph_runs
  ADD COLUMN IF NOT EXISTS external_trace_url TEXT;
