import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../../db/client.js';
import {
  decideFleetGraphHitlRequest,
  executeFleetGraphRun,
  getFleetGraphMetrics,
  getFleetGraphTraceDetail,
  listFleetGraphOpenFindings,
  listFleetGraphRecentRuns,
  snoozeFleetGraphFinding,
} from './runtime.js';
import {
  cleanupFleetGraphTables,
  createFleetGraphTestContext,
  destroyFleetGraphTestContext,
  seedHealthyIssue,
  seedIssueWithOpenBlocker,
  seedProjectWithHypothesis,
  seedSprintContextForIssue,
  seedSprintMissingStandup,
  seedSprintOverduePlanApproval,
  seedStaleIssue,
  seedWeeklyPlan,
  seedWeeklyRetro,
  type FleetGraphTestContext,
} from './__tests__/fixtures.js';

describe('FleetGraph runtime', () => {
  let ctx: FleetGraphTestContext;

  beforeAll(async () => {
    ctx = await createFleetGraphTestContext();
  });

  afterAll(async () => {
    await destroyFleetGraphTestContext(ctx);
  });

  describe('TC1 weak weekly plan', () => {
    it('detects empty weekly plan as planning_risk', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedWeeklyPlan({ workspaceId: ctx.workspaceId, userId: ctx.userId, text: undefined });

      const result = await executeFleetGraphRun('on_demand', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
      });

      expect(result.run.branch).toBe('planning_risk');
      expect(result.signals.some((s) => s.type === 'planning_risk')).toBe(true);
      expect(result.signals[0]?.notificationDrafts?.length).toBeGreaterThan(0);
      expect(result.summary.toLowerCase()).toContain('planning_risk');
      expect(result.findings[0]?.status).toBe('open');
      expect(result.run.traceUrl).toMatch(/^\/fleetgraph\/traces\//);
    });

    it('detects short weekly plan as planning_risk', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedWeeklyPlan({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        text: 'Vague plan without measurable outcomes or owners.',
      });

      const result = await executeFleetGraphRun('on_demand', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
      });

      expect(result.run.branch).toBe('planning_risk');
      expect(result.signals[0]?.summary).toContain('too short');
    });
  });

  describe('TC2 incomplete retro evidence', () => {
    it('detects short retro as evidence_risk', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedWeeklyRetro({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        text: 'Done.',
      });

      const result = await executeFleetGraphRun('proactive_webhook', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        prompt: 'webhook-triggered proactive scan',
      });

      expect(result.run.branch).toBe('evidence_risk');
      expect(result.signals[0]?.evidence.some((e) => e.startsWith('retro_text_length:'))).toBe(true);
      expect(result.run.trigger).toBe('proactive_webhook');
    });
  });

  describe('TC3 hypothesis drift', () => {
    it('detects project with hypothesis but no success criteria', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedProjectWithHypothesis({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        hypothesisText: 'We believe faster onboarding will increase weekly active usage.',
      });

      const result = await executeFleetGraphRun('on_demand', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
      });

      expect(result.run.branch).toBe('hypothesis_risk');
      expect(result.signals[0]?.title.toLowerCase()).toContain('hypothesis');
      expect(result.signals[0]?.summary.toLowerCase()).toContain('success criteria');
    });
  });

  describe('TC4 compliance HITL', () => {
    it('creates compliance_risk signal with pending HITL approval', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedHealthyIssue({ workspaceId: ctx.workspaceId, userId: ctx.userId });

      const result = await executeFleetGraphRun('on_demand', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        prompt: 'compliance gate review',
      });

      expect(result.run.branch).toBe('compliance_risk');
      expect(result.hitlRequestId).toBeTruthy();
      expect(result.findings.some((f) => f.status === 'pending_approval')).toBe(true);
      expect(result.signals[0]?.requiresHitl).toBe(true);
    });
  });

  describe('TC5 stale blocker/issue', () => {
    it('detects stale high-priority issue as execution_risk', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedStaleIssue({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        priority: 'high',
      });

      const result = await executeFleetGraphRun('proactive_poll', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        prompt: 'scheduled proactive scan',
      });

      expect(result.run.branch).toBe('execution_risk');
      expect(result.signals[0]?.severity).toBe('high');
      expect(result.signals[0]?.summary).toContain('hours');
      expect(result.run.trigger).toBe('proactive_poll');
    });

    it('detects open blocker iteration even when issue was recently updated', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      const issueId = await seedIssueWithOpenBlocker({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        blockerText: 'Blocked on dependency review from platform team.',
      });
      await seedSprintContextForIssue({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        issueId,
      });

      const result = await executeFleetGraphRun('proactive_webhook', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        documentId: issueId,
        documentType: 'issue',
        prompt: 'webhook-triggered proactive scan',
      });

      expect(result.run.branch).toBe('execution_risk');
      expect(result.signals[0]?.title.toLowerCase()).toContain('blocker');
      expect(result.signals[0]?.evidence.some((entry) => entry.startsWith('blocker_age_hours:'))).toBe(
        true
      );
      expect(result.signals[0]?.evidence.some((entry) => entry.startsWith('sprint_end_within_hours:'))).toBe(
        true
      );
      expect(result.signals[0]?.evidence).toContain('assignee_missing_recent_standup:true');
    });
  });

  describe('TC6 context-aware on-demand', () => {
    it('scopes signals to the requested issue document', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      const issueId = await seedStaleIssue({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        title: 'Context Issue',
      });
      await seedWeeklyPlan({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        text: undefined,
        title: 'Other Plan',
      });

      const result = await executeFleetGraphRun('on_demand', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        documentId: issueId,
        documentType: 'issue',
        prompt: 'what should happen next?',
      });

      expect(result.signals.length).toBeGreaterThan(0);
      expect(result.signals.every((s) => s.entityId === issueId || s.entityType === 'issue')).toBe(
        true
      );
      expect(result.signals.some((s) => s.entityId === issueId)).toBe(true);
    });
  });

  describe('TC7 missing standup accountability', () => {
    it('detects workspace standup gap as accountability_risk', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedSprintMissingStandup({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
      });

      const result = await executeFleetGraphRun('proactive_poll', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        prompt: 'scheduled proactive scan',
      });

      expect(result.run.branch).toBe('accountability_risk');
      expect(result.signals.some((s) => s.type === 'accountability_risk')).toBe(true);
      expect(result.signals[0]?.evidence.some((e) => e.startsWith('days_since_last_standup:'))).toBe(
        true
      );
    });
  });

  describe('TC8 overdue plan approval', () => {
    it('detects pending plan approval as planning_risk', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedSprintOverduePlanApproval({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
      });

      const result = await executeFleetGraphRun('proactive_webhook', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        prompt: 'webhook-triggered proactive scan',
      });

      expect(result.run.branch).toBe('planning_risk');
      expect(result.signals.some((s) => s.title.toLowerCase().includes('overdue plan approval'))).toBe(
        true
      );
      expect(result.signals[0]?.evidence).toContain('approval_type:plan');
    });
  });

  describe('cross-cutting behavior', () => {
    it('returns no_action when all documents are healthy', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedHealthyIssue({ workspaceId: ctx.workspaceId, userId: ctx.userId });

      const result = await executeFleetGraphRun('on_demand', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
      });

      expect(result.run.branch).toBe('no_action');
      expect(result.signals).toHaveLength(0);
      expect(result.summary).toContain('no actionable signals');
    });

    it('produces divergent branches across different Ship states', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedStaleIssue({ workspaceId: ctx.workspaceId, userId: ctx.userId });

      const executionResult = await executeFleetGraphRun('on_demand', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
      });

      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedHealthyIssue({ workspaceId: ctx.workspaceId, userId: ctx.userId });

      const complianceResult = await executeFleetGraphRun('on_demand', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        prompt: 'security audit review',
      });

      expect(executionResult.run.branch).toBe('execution_risk');
      expect(complianceResult.run.branch).toBe('compliance_risk');
      expect(executionResult.run.branch).not.toBe(complianceResult.run.branch);
    });

    it('approves and rejects HITL requests and updates finding status', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedHealthyIssue({ workspaceId: ctx.workspaceId, userId: ctx.userId });

      const runResult = await executeFleetGraphRun('on_demand', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        prompt: 'compliance audit',
      });

      expect(runResult.hitlRequestId).toBeTruthy();
      const hitlRequestId = runResult.hitlRequestId as string;

      const approveDecision = await decideFleetGraphHitlRequest(
        ctx.workspaceId,
        hitlRequestId,
        ctx.userId,
        true,
        'Approved for test'
      );
      expect(approveDecision.decisionStatus).toBe('approved');
      expect(approveDecision.actionExecuted).toBe(true);

      const approvedFinding = await pool.query(
        `SELECT status FROM fleetgraph_findings WHERE id = $1`,
        [approveDecision.findingId]
      );
      expect(approvedFinding.rows[0].status).toBe('resolved');

      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedHealthyIssue({ workspaceId: ctx.workspaceId, userId: ctx.userId });

      const rejectRun = await executeFleetGraphRun('on_demand', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        prompt: 'security compliance check',
      });
      const rejectHitlId = rejectRun.hitlRequestId as string;

      const rejectDecision = await decideFleetGraphHitlRequest(
        ctx.workspaceId,
        rejectHitlId,
        ctx.userId,
        false,
        'Rejected for test'
      );
      expect(rejectDecision.decisionStatus).toBe('rejected');

      const rejectedFinding = await pool.query(
        `SELECT status FROM fleetgraph_findings WHERE id = $1`,
        [rejectDecision.findingId]
      );
      expect(rejectedFinding.rows[0].status).toBe('rejected');
    });

    it('snoozes findings and suppresses them until expiry', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedWeeklyPlan({ workspaceId: ctx.workspaceId, userId: ctx.userId, text: undefined });

      const runResult = await executeFleetGraphRun('on_demand', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
      });
      const findingId = runResult.findings[0]?.id as string;
      expect(findingId).toBeTruthy();

      await snoozeFleetGraphFinding(ctx.workspaceId, findingId, ctx.userId, 24, 'Snooze for test');

      const openAfterSnooze = await listFleetGraphOpenFindings(ctx.workspaceId);
      expect(openAfterSnooze.some((f) => f.id === findingId)).toBe(false);

      await pool.query(
        `UPDATE fleetgraph_findings
         SET snoozed_until = NOW() - INTERVAL '1 minute', status = 'snoozed'
         WHERE id = $1`,
        [findingId]
      );

      await executeFleetGraphRun('on_demand', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
      });

      const openAfterExpiry = await listFleetGraphOpenFindings(ctx.workspaceId);
      expect(openAfterExpiry.some((f) => f.id === findingId)).toBe(true);
    });

    it('preserves snoozed findings during dedupe upsert within snooze window', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedWeeklyPlan({ workspaceId: ctx.workspaceId, userId: ctx.userId, text: undefined });

      const runResult = await executeFleetGraphRun('on_demand', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
      });
      const findingId = runResult.findings[0]?.id as string;

      await snoozeFleetGraphFinding(ctx.workspaceId, findingId, ctx.userId, 24);

      await executeFleetGraphRun('on_demand', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
      });

      const statusResult = await pool.query(`SELECT status FROM fleetgraph_findings WHERE id = $1`, [
        findingId,
      ]);
      expect(statusResult.rows[0].status).toBe('snoozed');
    });

    it('dedupes findings on repeated runs with the same signal', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedWeeklyPlan({ workspaceId: ctx.workspaceId, userId: ctx.userId, text: undefined });

      await executeFleetGraphRun('on_demand', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
      });
      await executeFleetGraphRun('on_demand', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
      });

      const countResult = await pool.query(
        `SELECT COUNT(*)::text AS count FROM fleetgraph_findings WHERE workspace_id = $1`,
        [ctx.workspaceId]
      );
      expect(Number(countResult.rows[0].count)).toBe(1);
    });

    it('returns metrics and recent runs for the workspace', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedWeeklyRetro({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        text: 'Short retro.',
      });

      const result = await executeFleetGraphRun('on_demand', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
      });

      await pool.query(
        `UPDATE fleetgraph_runs
         SET trace_url = $1
         WHERE workspace_id = $2
           AND trace_id = $3`,
        [
          'https://external-observability.example/trace/stale-external-trace',
          ctx.workspaceId,
          result.run.traceId,
        ]
      );

      const metrics = await getFleetGraphMetrics(ctx.workspaceId);
      expect(metrics.runCount).toBeGreaterThanOrEqual(1);
      expect(metrics.recentTraceUrls.length).toBeGreaterThanOrEqual(1);
      expect(metrics.recentTraceUrls[0]).toBe(`/fleetgraph/traces/${result.run.traceId}`);
      expect(metrics.monthlyProjectionUsd.users100).toBeGreaterThan(0);

      const runList = await listFleetGraphRecentRuns(ctx.workspaceId);
      expect(runList.runs.length).toBeGreaterThanOrEqual(1);
      expect(runList.total).toBeGreaterThanOrEqual(1);
      expect(runList.runs[0]?.traceId).toBe(result.run.traceId);
      expect(runList.runs[0]?.traceUrl).toBe(`/fleetgraph/traces/${result.run.traceId}`);

      const traceDetail = await getFleetGraphTraceDetail(ctx.workspaceId, result.run.traceId);
      expect(traceDetail.traceUrl).toBe(`/fleetgraph/traces/${result.run.traceId}`);

      const findings = await listFleetGraphOpenFindings(ctx.workspaceId);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0]?.traceId).toBe(result.run.traceId);
      expect(findings[0]?.traceUrl).toBe(`/fleetgraph/traces/${result.run.traceId}`);
    });

    it('surfaces findings within the PRD 5-minute latency window', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedStaleIssue({ workspaceId: ctx.workspaceId, userId: ctx.userId });

      const startedAt = Date.now();
      const result = await executeFleetGraphRun('proactive_webhook', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        prompt: 'webhook-triggered proactive scan',
      });
      const elapsedMs = Date.now() - startedAt;

      expect(result.run.latencyMs).toBeLessThan(300_000);
      expect(elapsedMs).toBeLessThan(300_000);
      expect(result.signals.length).toBeGreaterThan(0);
    });
  });
});
