import { describe, it, expect } from 'vitest';
import { buildNotificationDrafts } from './notifications.js';
import type { FleetGraphSignal } from './types.js';

function baseSignal(overrides: Partial<FleetGraphSignal>): FleetGraphSignal {
  return {
    type: 'execution_risk',
    severity: 'medium',
    confidence: 0.8,
    title: 'Test',
    summary: 'Test summary',
    entityType: 'issue',
    entityId: '00000000-0000-4000-8000-000000000001',
    evidence: [],
    requiresHitl: false,
    ...overrides,
  };
}

describe('FleetGraph notifications', () => {
  it('routes planning_risk to manager and week owner', () => {
    const drafts = buildNotificationDrafts(baseSignal({ type: 'planning_risk' }));
    expect(drafts.some((draft) => draft.role === 'engineering_manager')).toBe(true);
    expect(drafts.some((draft) => draft.role === 'week_owner')).toBe(true);
  });

  it('adds director escalation for high severity', () => {
    const drafts = buildNotificationDrafts(baseSignal({ severity: 'high' }));
    expect(drafts.some((draft) => draft.role === 'director')).toBe(true);
  });
});
