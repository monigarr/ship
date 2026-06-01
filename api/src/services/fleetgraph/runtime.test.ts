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
      expect(result.run.externalTraceUrl).toBeNull();
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

    it('returns distinct blocker vs describe responses for same issue context', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      const issueId = await seedIssueWithOpenBlocker({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        blockerText: 'Blocked on API contract alignment with external team.',
      });

      const blockersResult = await executeFleetGraphRun('on_demand', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        documentId: issueId,
        documentType: 'issue',
        prompt: 'What are the current blockers?',
      });

      const describeResult = await executeFleetGraphRun('on_demand', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        documentId: issueId,
        documentType: 'issue',
        prompt: 'Describe this issue',
      });

      expect(blockersResult.intent).toBe('blockers');
      expect(blockersResult.responseKind).toBe('blockers');
      expect(blockersResult.contextSummary?.blockers?.length).toBeGreaterThanOrEqual(1);
      expect(blockersResult.summary.toLowerCase()).toContain('blocker');

      expect(describeResult.intent).toBe('describe_issue');
      expect(describeResult.responseKind).toBe('issue_description');
      expect(describeResult.contextSummary?.issueDescription).toBeTypeOf('string');
      expect(describeResult.signals).toHaveLength(0);

      expect(describeResult.summary).not.toEqual(blockersResult.summary);
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
      expect(metrics.tokenTotals.all).toBeGreaterThanOrEqual(1);
      expect(metrics.tokenTotals.current30Days).toBeGreaterThanOrEqual(1);
      expect(metrics.spend.runtimeTotalUsd).toBeGreaterThanOrEqual(0);
      expect(metrics.monthlyProjection.basis).toBe('trailing_30_day_daily_average');
      expect(Array.isArray(metrics.modelUsage)).toBe(true);

      const runList = await listFleetGraphRecentRuns(ctx.workspaceId);
      expect(runList.runs.length).toBeGreaterThanOrEqual(1);
      expect(runList.total).toBeGreaterThanOrEqual(1);
      expect(runList.runs[0]?.traceId).toBe(result.run.traceId);
      expect(runList.runs[0]?.traceUrl).toBe(`/fleetgraph/traces/${result.run.traceId}`);
      expect(runList.runs[0]?.externalTraceUrl).toBeNull();
      expect(runList.runs[0]?.topSignal?.signalType).toBe('evidence_risk');
      expect(runList.runs[0]?.affectedRecord?.title).toBe('Test Weekly Retro');
      expect(runList.runs[0]?.nextAction).toContain('Attach replayable evidence');
      expect(runList.runs[0]?.audience.length).toBeGreaterThan(0);

      const traceDetail = await getFleetGraphTraceDetail(ctx.workspaceId, result.run.traceId);
      expect(traceDetail.traceUrl).toBe(`/fleetgraph/traces/${result.run.traceId}`);
      expect(traceDetail.externalTraceUrl).toBeNull();
      expect(traceDetail.observability.branchExplanation).toContain('evidence_risk');
      expect(traceDetail.findings[0]?.affectedRecord?.title).toBe('Test Weekly Retro');
      expect(traceDetail.findings[0]?.evidenceChecklist.length).toBeGreaterThan(0);
      expect(traceDetail.findings[0]?.hitlState.label).toBe('No protected action');

      const findings = await listFleetGraphOpenFindings(ctx.workspaceId);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0]?.traceId).toBe(result.run.traceId);
      expect(findings[0]?.traceUrl).toBe(`/fleetgraph/traces/${result.run.traceId}`);
      expect(findings[0]?.externalTraceUrl).toBeNull();
    });

    it('computes token-source and billed delta metrics from run truth fields', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedWeeklyPlan({ workspaceId: ctx.workspaceId, userId: ctx.userId, text: undefined });

      const first = await executeFleetGraphRun('on_demand', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
      });
      const second = await executeFleetGraphRun('on_demand', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
      });

      await pool.query(
        `UPDATE fleetgraph_runs
         SET token_estimate = $1,
             runtime_spend_usd = $2,
             cost_estimate_usd = $2,
             billed_spend_usd = $3,
             model_id = $4,
             token_source = 'actual_model_usage',
             created_at = NOW() - INTERVAL '5 days'
         WHERE workspace_id = $5
           AND trace_id = $6`,
        [1200, 2.4, 2.7, 'test.model.actual', ctx.workspaceId, first.run.traceId]
      );

      await pool.query(
        `UPDATE fleetgraph_runs
         SET token_estimate = $1,
             runtime_spend_usd = $2,
             cost_estimate_usd = $2,
             billed_spend_usd = NULL,
             model_id = NULL,
             token_source = 'heuristic_estimate',
             created_at = NOW() - INTERVAL '35 days'
         WHERE workspace_id = $3
           AND trace_id = $4`,
        [300, 0.3, ctx.workspaceId, second.run.traceId]
      );

      const metrics = await getFleetGraphMetrics(ctx.workspaceId);
      expect(metrics.runCount).toBe(2);
      expect(metrics.tokenTotals.all).toBe(1500);
      expect(metrics.tokenTotals.actualModelUsage).toBe(1200);
      expect(metrics.tokenTotals.heuristicEstimate).toBe(300);
      expect(metrics.tokenTotals.current30Days).toBe(1200);
      expect(metrics.tokenTotals.previous30Days).toBe(300);
      expect(metrics.spend.runtimeTotalUsd).toBeCloseTo(2.7, 6);
      expect(metrics.spend.billedTotalUsd).toBeCloseTo(2.7, 6);
      expect(metrics.spend.deltaUsd).toBeCloseTo(0, 6);
      expect(metrics.spend.billedCoverageRuns).toBe(1);
      expect(metrics.monthlyProjection.runtimeUsd).toBeCloseTo(2.4, 6);
      expect(metrics.monthlyProjection.billedUsd).toBeCloseTo(2.7, 6);
      expect(metrics.monthlyProjection.deltaUsd).toBeCloseTo(0.3, 6);
      expect(metrics.modelUsage[0]?.modelId).toBe('test.model.actual');
      expect(metrics.modelUsage[0]?.tokenSource).toBe('actual_model_usage');
    });

    it('returns external trace URLs when persisted as additive metadata', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);
      await seedWeeklyPlan({ workspaceId: ctx.workspaceId, userId: ctx.userId, text: undefined });

      const result = await executeFleetGraphRun('on_demand', {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
      });

      const langSmithUrl =
        'https://smith.langchain.com/o/53ea29ad-725a-449d-8454-a5e5b940ea6c/projects/p/94ee9aa8-6f2b-42b6-80d5-d5c18af5729d?runview=traces';
      await pool.query(
        `UPDATE fleetgraph_runs
         SET external_trace_url = $1
         WHERE workspace_id = $2
           AND trace_id = $3`,
        [langSmithUrl, ctx.workspaceId, result.run.traceId]
      );

      const runList = await listFleetGraphRecentRuns(ctx.workspaceId);
      expect(runList.runs[0]?.externalTraceUrl).toBe(langSmithUrl);

      const detail = await getFleetGraphTraceDetail(ctx.workspaceId, result.run.traceId);
      expect(detail.externalTraceUrl).toBe(langSmithUrl);
      expect(detail.run.externalTraceUrl).toBe(langSmithUrl);

      const findings = await listFleetGraphOpenFindings(ctx.workspaceId);
      expect(findings[0]?.externalTraceUrl).toBe(langSmithUrl);
    });

    it('repairs legacy trace rows so the index opens a full in-app trace detail', async () => {
      await cleanupFleetGraphTables(ctx.workspaceId);

      const legacyRun = await pool.query<{ id: string }>(
        `INSERT INTO fleetgraph_runs (
           workspace_id, user_id, trigger, branch, trace_id, trace_url,
           latency_ms, token_estimate, cost_estimate_usd, run_input, run_output
         )
         VALUES (
           $1, $2, 'proactive_poll', 'execution_risk', '', '/fleetgraph/traces',
           800, 0, 0, '{}'::jsonb, '{"summary":"legacy trace index row"}'::jsonb
         )
         RETURNING id`,
        [ctx.workspaceId, ctx.userId]
      );
      const legacyRunId = legacyRun.rows[0]?.id;
      expect(legacyRunId).toBeTruthy();
      if (!legacyRunId) {
        throw new Error('Failed to create legacy FleetGraph run fixture');
      }

      await pool.query(
        `INSERT INTO fleetgraph_findings (
           workspace_id, run_id, signal_type, severity, confidence, title, summary,
           entity_type, entity_id, evidence, dedupe_key, status
         )
         VALUES (
           $1, $2, 'execution_risk', 'high', 0.91, 'Legacy execution risk',
           'Legacy row should still resolve to a detail trace.', 'workspace', NULL,
           '["legacy_trace_repair:true"]'::jsonb, $3, 'open'
         )`,
        [ctx.workspaceId, legacyRunId, `${ctx.workspaceId}:legacy-trace-detail`]
      );

      await pool.query(
        `INSERT INTO fleetgraph_trace_events (
           workspace_id, trace_id, run_id, phase, event_name, event_status, latency_ms, metadata
         )
         VALUES ($1, '', $2, 'detection', 'signals_detected', 'ok', 15, '{"legacy":true}'::jsonb)`,
        [ctx.workspaceId, legacyRunId]
      );

      const runList = await listFleetGraphRecentRuns(ctx.workspaceId);
      const repairedRun = runList.runs.find((run) => run.runId === legacyRunId);

      expect(repairedRun?.traceId).toBe(legacyRunId);
      expect(repairedRun?.traceUrl).toBe(`/fleetgraph/traces/${legacyRunId}`);

      const traceDetail = await getFleetGraphTraceDetail(ctx.workspaceId, legacyRunId);
      expect(traceDetail.traceId).toBe(legacyRunId);
      expect(traceDetail.traceUrl).toBe(`/fleetgraph/traces/${legacyRunId}`);
      expect(traceDetail.timeline.some((event) => event.eventName === 'signals_detected')).toBe(true);
      expect(traceDetail.findings[0]?.signalType).toBe('execution_risk');
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
