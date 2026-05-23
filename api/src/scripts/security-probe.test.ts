import { describe, expect, it } from 'vitest';
import { severityFromAudit, summarize, toMarkdown } from './security-probe.js';

describe('security probe helpers', () => {
  it('maps audit severities deterministically', () => {
    expect(severityFromAudit('critical')).toBe('critical');
    expect(severityFromAudit('high')).toBe('high');
    expect(severityFromAudit('moderate')).toBe('medium');
    expect(severityFromAudit('low')).toBe('low');
    expect(severityFromAudit('unknown')).toBe('info');
  });

  it('summarizes finding statuses and severities', () => {
    const summary = summarize([
      {
        id: 'f1',
        surface: 'auth-session',
        status: 'pass',
        severity: 'info',
        title: 'A',
        details: 'A',
        reproduction: ['step'],
      },
      {
        id: 'f2',
        surface: 'dependencies',
        status: 'warn',
        severity: 'high',
        title: 'B',
        details: 'B',
        reproduction: ['step'],
      },
    ]);

    expect(summary.total).toBe(2);
    expect(summary.byStatus.pass).toBe(1);
    expect(summary.byStatus.warn).toBe(1);
    expect(summary.bySeverity.info).toBe(1);
    expect(summary.bySeverity.high).toBe(1);
  });

  it('renders markdown report sections', () => {
    const markdown = toMarkdown({
      generatedAt: '2026-01-01T00:00:00.000Z',
      target: { baseUrl: 'http://localhost:3000', wsBaseUrl: 'ws://localhost:3000' },
      summary: {
        total: 1,
        byStatus: { pass: 1, fail: 0, warn: 0, skip: 0, error: 0 },
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 1 },
      },
      findings: [
        {
          id: 'auth-1',
          surface: 'auth-session',
          status: 'pass',
          severity: 'info',
          title: 'Route protected',
          details: 'Details',
          reproduction: ['curl ...'],
        },
      ],
    });

    expect(markdown).toContain('# Security Probe Report');
    expect(markdown).toContain('## Findings');
    expect(markdown).toContain('### auth-1 - Route protected');
  });
});
