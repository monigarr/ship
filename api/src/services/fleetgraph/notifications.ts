/**
 * @version 0.1.0
 * @date 2026-05-25
 * @author Monica Peters <monica.peters@gfachallenger.gauntletai.com>
 *
 * Purpose: Role-based notification draft routing for FleetGraph findings.
 *
 * Usage: Import `buildNotificationDrafts` from runtime after signal detection.
 *
 * Example:
 *   const drafts = buildNotificationDrafts(signal);
 *
 * Dependencies: FleetGraphSignal types.
 *
 * Security/PHI: Role labels only; no external delivery.
 * HIPAA: N/A — no PHI.
 * FHIR: N/A — not interoperability.
 * Accessibility: N/A — non-UI.
 * Performance: O(1) per signal.
 * Stability: Deterministic routing by signal type and severity.
 * Legal/compliance: N/A — in-product drafts only.
 */

import type { FleetGraphBranch, FleetGraphSignal } from './types.js';

export interface FleetGraphNotificationDraft {
  role: string;
  reason: string;
}

const ROLE_BY_BRANCH: Record<
  Exclude<FleetGraphBranch, 'no_action'>,
  FleetGraphNotificationDraft[]
> = {
  planning_risk: [
    { role: 'engineering_manager', reason: 'Weekly plan quality or approval needs review.' },
    { role: 'week_owner', reason: 'Plan commitments may lack measurable outcomes.' },
  ],
  execution_risk: [
    { role: 'engineering_manager', reason: 'Stale issue or aged blocker near sprint end.' },
    { role: 'assignee', reason: 'Issue movement or blocker resolution needed.' },
  ],
  evidence_risk: [
    { role: 'week_owner', reason: 'Retro or completion proof appears incomplete.' },
    { role: 'engineering_manager', reason: 'Review replayability before sign-off.' },
  ],
  hypothesis_risk: [
    { role: 'product_manager', reason: 'Hypothesis lacks measurable success criteria.' },
    { role: 'program_manager', reason: 'Delivery may drift from stated outcome.' },
  ],
  compliance_risk: [
    { role: 'security_reviewer', reason: 'Compliance-sensitive action requires human gate.' },
    { role: 'qa_lead', reason: 'Verification artifacts may be incomplete.' },
  ],
  accountability_risk: [
    { role: 'engineering_manager', reason: 'Standup or accountability gap detected.' },
    { role: 'team_lead', reason: 'Assignee missing expected standup update.' },
  ],
};

export function buildNotificationDrafts(signal: FleetGraphSignal): FleetGraphNotificationDraft[] {
  if (signal.type === 'no_action') {
    return [];
  }

  const base = ROLE_BY_BRANCH[signal.type] ?? [];
  if (signal.severity !== 'high') {
    return base;
  }

  const escalated = [...base];
  if (!escalated.some((draft) => draft.role === 'director')) {
    escalated.push({
      role: 'director',
      reason: 'High-severity FleetGraph finding may need escalation.',
    });
  }
  return escalated;
}

export function enrichSignalsWithNotificationDrafts(
  signals: FleetGraphSignal[]
): FleetGraphSignal[] {
  return signals.map((signal) => ({
    ...signal,
    notificationDrafts: buildNotificationDrafts(signal),
  }));
}
