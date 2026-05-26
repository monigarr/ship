import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { pool } from '../../db/client.js';
import {
  ensureProactiveScanTables,
  isPlanningReviewWindow,
  runFleetGraphProactivePoll,
  runFleetGraphProactiveWebhook,
  shouldRunScanTier,
  startFleetGraphProactiveScheduler,
} from './proactive.js';
import { emitFleetGraphShipEvent } from './proactive-ship-hooks.js';
import {
  cleanupFleetGraphTables,
  createFleetGraphTestContext,
  destroyFleetGraphTestContext,
  seedStaleIssue,
  type FleetGraphTestContext,
} from './__tests__/fixtures.js';

describe('FleetGraph proactive scheduler', () => {
  let ctx: FleetGraphTestContext;
  const originalEnabled = process.env.FLEETGRAPH_PROACTIVE_ENABLED;
  const originalInterval = process.env.FLEETGRAPH_POLL_INTERVAL_MS;
  const originalSkipUnchanged = process.env.FLEETGRAPH_SKIP_UNCHANGED_SCANS;
  const originalWebhookDebounce = process.env.FLEETGRAPH_WEBHOOK_DEBOUNCE_MS;

  beforeAll(async () => {
    ctx = await createFleetGraphTestContext();
    await ensureProactiveScanTables();
  });

  afterAll(async () => {
    if (originalEnabled === undefined) {
      delete process.env.FLEETGRAPH_PROACTIVE_ENABLED;
    } else {
      process.env.FLEETGRAPH_PROACTIVE_ENABLED = originalEnabled;
    }
    if (originalInterval === undefined) {
      delete process.env.FLEETGRAPH_POLL_INTERVAL_MS;
    } else {
      process.env.FLEETGRAPH_POLL_INTERVAL_MS = originalInterval;
    }
    if (originalSkipUnchanged === undefined) {
      delete process.env.FLEETGRAPH_SKIP_UNCHANGED_SCANS;
    } else {
      process.env.FLEETGRAPH_SKIP_UNCHANGED_SCANS = originalSkipUnchanged;
    }
    if (originalWebhookDebounce === undefined) {
      delete process.env.FLEETGRAPH_WEBHOOK_DEBOUNCE_MS;
    } else {
      process.env.FLEETGRAPH_WEBHOOK_DEBOUNCE_MS = originalWebhookDebounce;
    }
    await destroyFleetGraphTestContext(ctx);
  });

  it('runFleetGraphProactivePoll creates runs for active workspaces', async () => {
    process.env.FLEETGRAPH_SKIP_UNCHANGED_SCANS = '0';
    await cleanupFleetGraphTables(ctx.workspaceId);
    await pool.query('DELETE FROM fleetgraph_scan_state WHERE workspace_id = $1', [ctx.workspaceId]);
    await seedStaleIssue({ workspaceId: ctx.workspaceId, userId: ctx.userId });

    const stats = await runFleetGraphProactivePoll('lightweight');

    expect(stats.ran).toBeGreaterThanOrEqual(1);

    const runsResult = await pool.query(
      `SELECT trigger, run_input FROM fleetgraph_runs WHERE workspace_id = $1`,
      [ctx.workspaceId]
    );

    expect(runsResult.rows.length).toBeGreaterThanOrEqual(1);
    expect(runsResult.rows.some((row) => row.trigger === 'proactive_poll')).toBe(true);
    expect(
      runsResult.rows.some((row) =>
        String(row.run_input?.prompt ?? '').includes('lightweight stale-work and blocker check')
      )
    ).toBe(true);
  });

  it('continues polling when one workspace scan fails', async () => {
    process.env.FLEETGRAPH_SKIP_UNCHANGED_SCANS = '0';
    await cleanupFleetGraphTables(ctx.workspaceId);
    await pool.query('DELETE FROM fleetgraph_scan_state WHERE workspace_id = $1', [ctx.workspaceId]);
    await seedStaleIssue({ workspaceId: ctx.workspaceId, userId: ctx.userId });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const secondWorkspace = await pool.query(
      `INSERT INTO workspaces (name) VALUES ('Broken FleetGraph Workspace') RETURNING id`
    );
    const brokenWorkspaceId = secondWorkspace.rows[0].id as string;

    try {
      await runFleetGraphProactivePoll('lightweight');
    } finally {
      await pool.query('DELETE FROM fleetgraph_scan_state WHERE workspace_id = $1', [brokenWorkspaceId]);
      await pool.query('DELETE FROM fleetgraph_runs WHERE workspace_id = $1', [brokenWorkspaceId]);
      await pool.query('DELETE FROM workspaces WHERE id = $1', [brokenWorkspaceId]);
      errorSpy.mockRestore();
    }

    const runsResult = await pool.query(
      `SELECT COUNT(*)::text AS count FROM fleetgraph_runs WHERE workspace_id = $1`,
      [ctx.workspaceId]
    );
    expect(Number(runsResult.rows[0].count)).toBeGreaterThanOrEqual(1);
  });

  it('skips unchanged lightweight scans when fingerprint is unchanged', async () => {
    process.env.FLEETGRAPH_SKIP_UNCHANGED_SCANS = '1';
    await cleanupFleetGraphTables(ctx.workspaceId);
    await pool.query('DELETE FROM fleetgraph_scan_state WHERE workspace_id = $1', [ctx.workspaceId]);
    await seedStaleIssue({ workspaceId: ctx.workspaceId, userId: ctx.userId });

    const first = await runFleetGraphProactivePoll('lightweight');
    expect(first.ran).toBeGreaterThanOrEqual(1);

    const beforeCount = await pool.query(
      `SELECT COUNT(*)::text AS count FROM fleetgraph_runs WHERE workspace_id = $1`,
      [ctx.workspaceId]
    );

    const second = await runFleetGraphProactivePoll('lightweight');
    expect(second.skipped).toBeGreaterThanOrEqual(1);

    const afterCount = await pool.query(
      `SELECT COUNT(*)::text AS count FROM fleetgraph_runs WHERE workspace_id = $1`,
      [ctx.workspaceId]
    );
    expect(Number(afterCount.rows[0].count)).toBe(Number(beforeCount.rows[0].count));
  });

  it('runs health scan tier with distinct prompt', async () => {
    process.env.FLEETGRAPH_SKIP_UNCHANGED_SCANS = '0';
    await cleanupFleetGraphTables(ctx.workspaceId);
    await pool.query('DELETE FROM fleetgraph_scan_state WHERE workspace_id = $1', [ctx.workspaceId]);
    await seedStaleIssue({ workspaceId: ctx.workspaceId, userId: ctx.userId });

    const stats = await runFleetGraphProactivePoll('health');
    expect(stats.ran).toBeGreaterThanOrEqual(1);

    const runsResult = await pool.query(
      `SELECT run_input FROM fleetgraph_runs WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [ctx.workspaceId]
    );
    expect(String(runsResult.rows[0].run_input?.prompt ?? '')).toContain('full project health');
  });

  it('debounces duplicate webhook triggers for the same document', async () => {
    process.env.FLEETGRAPH_WEBHOOK_DEBOUNCE_MS = '60000';
    await cleanupFleetGraphTables(ctx.workspaceId);
    await pool.query('DELETE FROM fleetgraph_webhook_dedupe WHERE workspace_id = $1', [ctx.workspaceId]);
    const issueId = await seedStaleIssue({ workspaceId: ctx.workspaceId, userId: ctx.userId });

    const first = await runFleetGraphProactiveWebhook(
      {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        documentId: issueId,
        documentType: 'issue',
      },
      { eventType: 'issue_updated', documentId: issueId, documentType: 'issue' }
    );

    expect('run' in first).toBe(true);

    const second = await runFleetGraphProactiveWebhook(
      {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        documentId: issueId,
        documentType: 'issue',
      },
      { eventType: 'issue_updated', documentId: issueId, documentType: 'issue' }
    );

    expect(second).toEqual({ skipped: true, reason: 'webhook_debounced' });
  });

  it('respects planning scan tier interval gating', async () => {
    process.env.FLEETGRAPH_PLANNING_WINDOW_DOW = '5';
    await cleanupFleetGraphTables(ctx.workspaceId);
    await pool.query('DELETE FROM fleetgraph_scan_state WHERE workspace_id = $1 AND scan_kind = $2', [
      ctx.workspaceId,
      'planning_window',
    ]);

    const due = await shouldRunScanTier(
      ctx.workspaceId,
      {
        kind: 'planning_window',
        intervalMs: 5 * 60 * 1000,
        prompt: 'planning',
        skipUnchanged: true,
      },
      new Date('2026-05-25T12:00:00.000Z')
    );

    expect(due).toBe(false);
  });

  it('isPlanningReviewWindow honors configured weekdays', () => {
    process.env.FLEETGRAPH_PLANNING_WINDOW_DOW = '1';
    const monday = new Date('2026-05-25T12:00:00.000Z');
    expect(isPlanningReviewWindow(monday)).toBe(true);

    const friday = new Date('2026-05-29T12:00:00.000Z');
    expect(isPlanningReviewWindow(friday)).toBe(false);
  });

  it('startFleetGraphProactiveScheduler returns no-op teardown when disabled', () => {
    process.env.FLEETGRAPH_PROACTIVE_ENABLED = '0';

    const stop = startFleetGraphProactiveScheduler();
    expect(typeof stop).toBe('function');
    stop();
  });

  it('emitFleetGraphShipEvent schedules a proactive webhook run', async () => {
    process.env.FLEETGRAPH_PROACTIVE_ENABLED = '1';
    process.env.FLEETGRAPH_WEBHOOK_DEBOUNCE_MS = '0';
    await cleanupFleetGraphTables(ctx.workspaceId);
    await pool.query('DELETE FROM fleetgraph_webhook_dedupe WHERE workspace_id = $1', [ctx.workspaceId]);
    const issueId = await seedStaleIssue({ workspaceId: ctx.workspaceId, userId: ctx.userId });

    emitFleetGraphShipEvent(
      { workspaceId: ctx.workspaceId, userId: ctx.userId },
      'issue_updated',
      issueId,
      'issue'
    );

    await vi.waitFor(
      async () => {
        const runsResult = await pool.query(
          `SELECT trigger FROM fleetgraph_runs
           WHERE workspace_id = $1 AND trigger = 'proactive_webhook'`,
          [ctx.workspaceId]
        );
        expect(runsResult.rows.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 5000 }
    );
  });
});
