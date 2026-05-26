-- FleetGraph notification draft routing persisted on findings
ALTER TABLE fleetgraph_findings
  ADD COLUMN IF NOT EXISTS notification_drafts JSONB NOT NULL DEFAULT '[]'::jsonb;
