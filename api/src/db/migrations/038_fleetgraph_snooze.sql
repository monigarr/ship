-- FleetGraph finding snooze support for HITL-aligned dismissal windows

ALTER TABLE fleetgraph_findings
  ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS snoozed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS snooze_note TEXT;
