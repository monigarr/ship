import crypto from 'crypto';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../app.js';
import { pool } from '../../../db/client.js';
import { ensureFleetGraphTables } from '../runtime.js';

export interface FleetGraphTestContext {
  app: Express;
  workspaceId: string;
  userId: string;
  sessionCookie: string;
  csrfToken: string;
  testRunId: string;
}

function tiptapParagraph(text: string): unknown {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

function tiptapHypothesisOnly(hypothesisText: string): unknown {
  return {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Hypothesis' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: hypothesisText }],
      },
    ],
  };
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

export async function seedWeeklyPlan(options: {
  workspaceId: string;
  userId: string;
  text?: string;
  title?: string;
}): Promise<string> {
  const content = options.text !== undefined ? tiptapParagraph(options.text) : null;
  const result = await pool.query(
    `INSERT INTO documents (workspace_id, document_type, title, created_by, content, visibility)
     VALUES ($1, 'weekly_plan', $2, $3, $4, 'workspace')
     RETURNING id`,
    [
      options.workspaceId,
      options.title ?? 'Test Weekly Plan',
      options.userId,
      content !== null ? JSON.stringify(content) : null,
    ]
  );
  return result.rows[0].id as string;
}

export async function seedWeeklyRetro(options: {
  workspaceId: string;
  userId: string;
  text: string;
  title?: string;
}): Promise<string> {
  const result = await pool.query(
    `INSERT INTO documents (workspace_id, document_type, title, created_by, content, visibility)
     VALUES ($1, 'weekly_retro', $2, $3, $4, 'workspace')
     RETURNING id`,
    [
      options.workspaceId,
      options.title ?? 'Test Weekly Retro',
      options.userId,
      JSON.stringify(tiptapParagraph(options.text)),
    ]
  );
  return result.rows[0].id as string;
}

export async function seedStaleIssue(options: {
  workspaceId: string;
  userId: string;
  priority?: string;
  title?: string;
  staleHours?: number;
}): Promise<string> {
  const staleHours = options.staleHours ?? 25;
  const result = await pool.query(
    `INSERT INTO documents (
       workspace_id, document_type, title, created_by, properties, visibility, updated_at
     )
     VALUES ($1, 'issue', $2, $3, $4, 'workspace', NOW() - ($5 || ' hours')::interval)
     RETURNING id`,
    [
      options.workspaceId,
      options.title ?? 'Stale Test Issue',
      options.userId,
      JSON.stringify({ state: 'in_progress', priority: options.priority ?? 'high' }),
      String(staleHours),
    ]
  );
  return result.rows[0].id as string;
}

export async function seedHealthyIssue(options: {
  workspaceId: string;
  userId: string;
  title?: string;
}): Promise<string> {
  const result = await pool.query(
    `INSERT INTO documents (workspace_id, document_type, title, created_by, properties, visibility)
     VALUES ($1, 'issue', $2, $3, $4, 'workspace')
     RETURNING id`,
    [
      options.workspaceId,
      options.title ?? 'Healthy Issue',
      options.userId,
      JSON.stringify({ state: 'in_progress', priority: 'medium' }),
    ]
  );
  return result.rows[0].id as string;
}

export async function seedProjectWithHypothesis(options: {
  workspaceId: string;
  userId: string;
  hypothesisText: string;
  title?: string;
}): Promise<string> {
  const result = await pool.query(
    `INSERT INTO documents (workspace_id, document_type, title, created_by, content, visibility)
     VALUES ($1, 'project', $2, $3, $4, 'workspace')
     RETURNING id`,
    [
      options.workspaceId,
      options.title ?? 'Test Project',
      options.userId,
      JSON.stringify(tiptapHypothesisOnly(options.hypothesisText)),
    ]
  );
  return result.rows[0].id as string;
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
