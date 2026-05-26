import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { pool } from '../../db/client.js';
import { runFleetGraphProactivePoll, startFleetGraphProactiveScheduler } from './proactive.js';
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

  beforeAll(async () => {
    ctx = await createFleetGraphTestContext();
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
    await destroyFleetGraphTestContext(ctx);
  });

  it('runFleetGraphProactivePoll creates runs for active workspaces', async () => {
    await cleanupFleetGraphTables(ctx.workspaceId);
    await seedStaleIssue({ workspaceId: ctx.workspaceId, userId: ctx.userId });

    await runFleetGraphProactivePoll();

    const runsResult = await pool.query(
      `SELECT trigger, branch FROM fleetgraph_runs WHERE workspace_id = $1`,
      [ctx.workspaceId]
    );

    expect(runsResult.rows.length).toBeGreaterThanOrEqual(1);
    expect(runsResult.rows.some((row) => row.trigger === 'proactive_poll')).toBe(true);
  });

  it('continues polling when one workspace scan fails', async () => {
    await cleanupFleetGraphTables(ctx.workspaceId);
    await seedStaleIssue({ workspaceId: ctx.workspaceId, userId: ctx.userId });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const secondWorkspace = await pool.query(
      `INSERT INTO workspaces (name) VALUES ('Broken FleetGraph Workspace') RETURNING id`
    );
    const brokenWorkspaceId = secondWorkspace.rows[0].id as string;

    try {
      await runFleetGraphProactivePoll();
    } finally {
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

  it('startFleetGraphProactiveScheduler returns no-op teardown when disabled', () => {
    process.env.FLEETGRAPH_PROACTIVE_ENABLED = '0';

    const stop = startFleetGraphProactiveScheduler();
    expect(typeof stop).toBe('function');
    stop();
  });
});
