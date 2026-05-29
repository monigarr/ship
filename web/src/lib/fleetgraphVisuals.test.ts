import { describe, expect, it } from 'vitest';
import {
  formatFleetGraphDateTime,
  getFleetGraphSeverityTone,
  getFleetGraphStatusTone,
  resolveExternalTraceHref,
  resolveInternalTraceHref,
} from './fleetgraphVisuals';

describe('fleetgraphVisuals', () => {
  it('maps known statuses to enterprise labels', () => {
    expect(getFleetGraphStatusTone('pending_approval').label).toBe('Pending Approval');
    expect(getFleetGraphStatusTone('open').label).toBe('Needs Attention');
    expect(getFleetGraphStatusTone('resolved').label).toBe('Resolved');
  });

  it('maps severities with stable defaults', () => {
    expect(getFleetGraphSeverityTone('high').label).toBe('High');
    expect(getFleetGraphSeverityTone('medium').label).toBe('Medium');
    expect(getFleetGraphSeverityTone('unknown').label).toBe('None');
  });

  it('resolves legacy internal trace URLs', () => {
    expect(resolveInternalTraceHref('internal://fleetgraph/trace-123')).toBe('/fleetgraph/traces/trace-123');
    expect(resolveInternalTraceHref('/fleetgraph/traces/trace-456')).toBe('/fleetgraph/traces/trace-456');
    expect(resolveInternalTraceHref('opaque-value', 'trace-789')).toBe('/fleetgraph/traces/trace-789');
    expect(
      resolveInternalTraceHref('https://external-observability.example/trace/stale-external-trace', 'trace-999')
    ).toBe('/fleetgraph/traces/trace-999');
    expect(resolveInternalTraceHref('https://external-observability.example/trace/stale-external-trace')).toBe(
      '/fleetgraph/traces'
    );
  });

  it('validates external trace URLs', () => {
    expect(
      resolveExternalTraceHref(
        'https://smith.langchain.com/o/53ea29ad-725a-449d-8454-a5e5b940ea6c/projects/p/94ee9aa8-6f2b-42b6-80d5-d5c18af5729d?runview=traces'
      )
    ).toBe(
      'https://smith.langchain.com/o/53ea29ad-725a-449d-8454-a5e5b940ea6c/projects/p/94ee9aa8-6f2b-42b6-80d5-d5c18af5729d?runview=traces'
    );
    expect(resolveExternalTraceHref('not-a-url')).toBeNull();
    expect(resolveExternalTraceHref('javascript:alert(1)')).toBeNull();
  });

  it('formats datetime values safely', () => {
    expect(formatFleetGraphDateTime('not-a-date')).toBe('not-a-date');
    expect(formatFleetGraphDateTime('2026-05-26T12:00:00.000Z')).not.toBe('2026-05-26T12:00:00.000Z');
  });
});
