import crypto from 'crypto';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../app.js';
import { pool } from '../../../db/client.js';
import { ensureFleetGraphTables } from '../runtime.js';

export {
  seedHealthyIssue,
  seedIssueWithOpenBlocker,
  seedProjectWithHypothesis,
  seedSprintContextForIssue,
  seedSprintMissingStandup,
  seedSprintOverduePlanApproval,
  seedStaleIssue,
  seedWeeklyPlan,
  seedWeeklyRetro,
} from '../seed-helpers.js';

export interface FleetGraphTestContext {
  app: Express;
  workspaceId: string;
  userId: string;
  sessionCookie: string;
  csrfToken: string;
  testRunId: string;
}

export async function createFleetGraphTestContext(): Promise<FleetGraphTestContext> {
  await ensureFleetGraphTables();
  const app = createApp();
  const testRunId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const testEmail = `fleetgraph-test-${testRunId}@ship.local`;
  const testWorkspaceName = `FleetGraph Test ${testRunId}`;

  const workspaceResult = await pool.query(
    `INSERT INTO workspaces (name) VALUES ($1) RETURNING id`,
    [testWorkspaceName]
  );
  const workspaceId = workspaceResult.rows[0].id as string;

  const userResult = await pool.query(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, 'test-hash', 'FleetGraph Test User')
     RETURNING id`,
    [testEmail]
  );
  const userId = userResult.rows[0].id as string;

  await pool.query(
    `INSERT INTO workspace_memberships (workspace_id, user_id, role)
     VALUES ($1, $2, 'admin')`,
    [workspaceId, userId]
  );

  const sessionId = crypto.randomBytes(32).toString('hex');
  await pool.query(
    `INSERT INTO sessions (id, user_id, workspace_id, expires_at)
     VALUES ($1, $2, $3, now() + interval '1 hour')`,
    [sessionId, userId, workspaceId]
  );

  let sessionCookie = `session_id=${sessionId}`;
  const csrfRes = await request(app).get('/api/csrf-token').set('Cookie', sessionCookie);
  const csrfToken = csrfRes.body.token as string;
  const connectSidCookie = csrfRes.headers['set-cookie']?.[0]?.split(';')[0] ?? '';
  if (connectSidCookie) {
    sessionCookie = `${sessionCookie}; ${connectSidCookie}`;
  }

  return { app, workspaceId, userId, sessionCookie, csrfToken, testRunId };
}

export async function cleanupFleetGraphTables(workspaceId: string): Promise<void> {
  await ensureFleetGraphTables();
  await pool.query(
    `DELETE FROM fleetgraph_hitl_requests
     WHERE workspace_id = $1`,
    [workspaceId]
  );
  await pool.query(
    `DELETE FROM fleetgraph_findings
     WHERE workspace_id = $1`,
    [workspaceId]
  );
  await pool.query(
    `DELETE FROM fleetgraph_runs
     WHERE workspace_id = $1`,
    [workspaceId]
  );
  await pool.query(`DELETE FROM documents WHERE workspace_id = $1`, [workspaceId]);
}

export async function destroyFleetGraphTestContext(ctx: FleetGraphTestContext): Promise<void> {
  await cleanupFleetGraphTables(ctx.workspaceId);
  await pool.query('DELETE FROM sessions WHERE user_id = $1', [ctx.userId]);
  await pool.query('DELETE FROM documents WHERE workspace_id = $1', [ctx.workspaceId]);
  await pool.query('DELETE FROM workspace_memberships WHERE workspace_id = $1', [ctx.workspaceId]);
  await pool.query('DELETE FROM users WHERE id = $1', [ctx.userId]);
  await pool.query('DELETE FROM workspaces WHERE id = $1', [ctx.workspaceId]);
}
