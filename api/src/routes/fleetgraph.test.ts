import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { pool } from '../db/client.js';
import {
  cleanupFleetGraphTables,
  createFleetGraphTestContext,
  destroyFleetGraphTestContext,
  seedHealthyIssue,
  seedStaleIssue,
  seedWeeklyPlan,
  type FleetGraphTestContext,
} from '../services/fleetgraph/__tests__/fixtures.js';

describe('FleetGraph API', () => {
  let ctx: FleetGraphTestContext;

  beforeAll(async () => {
    ctx = await createFleetGraphTestContext();
  });

  afterAll(async () => {
    await destroyFleetGraphTestContext(ctx);
  });

  describe('POST /api/fleetgraph/run', () => {
    it('returns 403 without authentication (CSRF enforced on POST)', async () => {
      const response = await request(ctx.app).post('/api/fleetgraph/run').send({});
      expect(response.status).toBe(403);
    });

    it('runs on-demand graph and returns run payload', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedWeeklyPlan({ workspaceId: ctx.workspaceId, userId: ctx.userId, text: undefined });

      const response = await request(ctx.app)
        .post('/api/fleetgraph/run')
        .set('Cookie', ctx.sessionCookie)
        .set('x-csrf-token', ctx.csrfToken)
        .send({ prompt: 'review this plan' });

      expect(response.status).toBe(200);
      expect(response.body.run).toBeDefined();
      expect(response.body.run.trigger).toBe('on_demand');
      expect(response.body.run.branch).toBe('planning_risk');
      expect(Array.isArray(response.body.signals)).toBe(true);
      expect(typeof response.body.summary).toBe('string');
    });
  });

  describe('POST /api/fleetgraph/proactive/webhook', () => {
    it('runs proactive webhook trigger', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      const issueId = await seedStaleIssue({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
      });

      const response = await request(ctx.app)
        .post('/api/fleetgraph/proactive/webhook')
        .set('Cookie', ctx.sessionCookie)
        .set('x-csrf-token', ctx.csrfToken)
        .send({ document_id: issueId, document_type: 'issue' });

      expect(response.status).toBe(200);
      expect(response.body.run.trigger).toBe('proactive_webhook');
      expect(response.body.run.branch).toBe('execution_risk');
    });
  });

  describe('GET /api/fleetgraph/findings', () => {
    it('returns open findings for the workspace', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedWeeklyPlan({ workspaceId: ctx.workspaceId, userId: ctx.userId, text: 'Too short.' });

      await request(ctx.app)
        .post('/api/fleetgraph/run')
        .set('Cookie', ctx.sessionCookie)
        .set('x-csrf-token', ctx.csrfToken)
        .send({});

      const response = await request(ctx.app)
        .get('/api/fleetgraph/findings')
        .set('Cookie', ctx.sessionCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.findings)).toBe(true);
      expect(response.body.findings.length).toBeGreaterThan(0);
      expect(response.body.findings[0]).toHaveProperty('traceUrl');
    });

    it('returns 401 without authentication', async () => {
      const response = await request(ctx.app).get('/api/fleetgraph/findings');
      expect(response.status).toBe(401);
    });

    it('returns evidence and hitlRequestId for pending compliance findings', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedHealthyIssue({ workspaceId: ctx.workspaceId, userId: ctx.userId });

      await request(ctx.app)
        .post('/api/fleetgraph/run')
        .set('Cookie', ctx.sessionCookie)
        .set('x-csrf-token', ctx.csrfToken)
        .send({ prompt: 'compliance gate review' });

      const response = await request(ctx.app)
        .get('/api/fleetgraph/findings')
        .set('Cookie', ctx.sessionCookie);

      expect(response.status).toBe(200);
      const pendingFinding = response.body.findings.find(
        (finding: { status: string }) => finding.status === 'pending_approval'
      );
      expect(pendingFinding).toBeDefined();
      expect(Array.isArray(pendingFinding.evidence)).toBe(true);
      expect(pendingFinding.evidence.length).toBeGreaterThan(0);
      expect(pendingFinding.hitlRequestId).toBeTruthy();
      expect(pendingFinding.entityType).toBeTruthy();
    });
  });

  describe('GET /api/fleetgraph/metrics', () => {
    it('returns metrics and monthly projections', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedStaleIssue({ workspaceId: ctx.workspaceId, userId: ctx.userId });

      await request(ctx.app)
        .post('/api/fleetgraph/run')
        .set('Cookie', ctx.sessionCookie)
        .set('x-csrf-token', ctx.csrfToken)
        .send({});

      const response = await request(ctx.app)
        .get('/api/fleetgraph/metrics')
        .set('Cookie', ctx.sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.runCount).toBeGreaterThanOrEqual(1);
      expect(response.body.monthlyProjectionUsd).toMatchObject({
        users100: expect.any(Number),
        users1000: expect.any(Number),
        users10000: expect.any(Number),
      });
      expect(Array.isArray(response.body.recentTraceUrls)).toBe(true);
    });
  });

  describe('GET /api/fleetgraph/traces', () => {
    it('returns recent runs with trace URLs', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedWeeklyPlan({ workspaceId: ctx.workspaceId, userId: ctx.userId, text: undefined });

      await request(ctx.app)
        .post('/api/fleetgraph/run')
        .set('Cookie', ctx.sessionCookie)
        .set('x-csrf-token', ctx.csrfToken)
        .send({});

      const response = await request(ctx.app)
        .get('/api/fleetgraph/traces')
        .set('Cookie', ctx.sessionCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.runs)).toBe(true);
      expect(response.body.runs[0]).toMatchObject({
        runId: expect.any(String),
        trigger: 'on_demand',
        traceUrl: expect.stringMatching(/^\/fleetgraph\/traces\//),
      });
    });
  });

  describe('GET /api/fleetgraph/traces/:traceId', () => {
    it('returns internal observability detail for a trace', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedWeeklyPlan({ workspaceId: ctx.workspaceId, userId: ctx.userId, text: undefined });

      const runResponse = await request(ctx.app)
        .post('/api/fleetgraph/run')
        .set('Cookie', ctx.sessionCookie)
        .set('x-csrf-token', ctx.csrfToken)
        .send({});

      const traceId = runResponse.body.run.traceId as string;
      expect(traceId).toBeTruthy();

      const response = await request(ctx.app)
        .get(`/api/fleetgraph/traces/${traceId}`)
        .set('Cookie', ctx.sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        traceId,
        run: {
          trigger: 'on_demand',
        },
        observability: {
          latencyBudgetMs: 300000,
        },
      });
      expect(Array.isArray(response.body.timeline)).toBe(true);
      expect(Array.isArray(response.body.findings)).toBe(true);
    });
  });

  describe('POST /api/fleetgraph/hitl/:requestId/approve|reject', () => {
    it('approves a pending HITL request', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedHealthyIssue({ workspaceId: ctx.workspaceId, userId: ctx.userId });

      const runResponse = await request(ctx.app)
        .post('/api/fleetgraph/run')
        .set('Cookie', ctx.sessionCookie)
        .set('x-csrf-token', ctx.csrfToken)
        .send({ prompt: 'compliance gate review' });

      const hitlRequestId = runResponse.body.hitlRequestId as string;
      expect(hitlRequestId).toBeTruthy();

      const approveResponse = await request(ctx.app)
        .post(`/api/fleetgraph/hitl/${hitlRequestId}/approve`)
        .set('Cookie', ctx.sessionCookie)
        .set('x-csrf-token', ctx.csrfToken)
        .send({ note: 'Approved in route test' });

      expect(approveResponse.status).toBe(200);
      expect(approveResponse.body.decisionStatus).toBe('approved');

      const findingStatus = await pool.query(
        `SELECT status FROM fleetgraph_findings WHERE id = $1`,
        [approveResponse.body.findingId]
      );
      expect(findingStatus.rows[0].status).toBe('resolved');
    });

    it('rejects a pending HITL request', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedHealthyIssue({ workspaceId: ctx.workspaceId, userId: ctx.userId });

      const runResponse = await request(ctx.app)
        .post('/api/fleetgraph/run')
        .set('Cookie', ctx.sessionCookie)
        .set('x-csrf-token', ctx.csrfToken)
        .send({ prompt: 'security audit' });

      const hitlRequestId = runResponse.body.hitlRequestId as string;

      const rejectResponse = await request(ctx.app)
        .post(`/api/fleetgraph/hitl/${hitlRequestId}/reject`)
        .set('Cookie', ctx.sessionCookie)
        .set('x-csrf-token', ctx.csrfToken)
        .send({ note: 'Rejected in route test' });

      expect(rejectResponse.status).toBe(200);
      expect(rejectResponse.body.decisionStatus).toBe('rejected');
    });
  });

  describe('POST /api/fleetgraph/findings/:findingId/snooze', () => {
    it('snoozes an open finding', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedWeeklyPlan({ workspaceId: ctx.workspaceId, userId: ctx.userId, text: undefined });

      const runResponse = await request(ctx.app)
        .post('/api/fleetgraph/run')
        .set('Cookie', ctx.sessionCookie)
        .set('x-csrf-token', ctx.csrfToken)
        .send({});

      const findingId = runResponse.body.findings[0].id as string;

      const snoozeResponse = await request(ctx.app)
        .post(`/api/fleetgraph/findings/${findingId}/snooze`)
        .set('Cookie', ctx.sessionCookie)
        .set('x-csrf-token', ctx.csrfToken)
        .send({ hours: 24, note: 'Snoozed in route test' });

      expect(snoozeResponse.status).toBe(200);
      expect(snoozeResponse.body.status).toBe('snoozed');
      expect(snoozeResponse.body.snoozedUntil).toBeTruthy();

      const findingsResponse = await request(ctx.app)
        .get('/api/fleetgraph/findings')
        .set('Cookie', ctx.sessionCookie);

      expect(findingsResponse.body.findings.some((f: { id: string }) => f.id === findingId)).toBe(
        false
      );
    });
  });
});
