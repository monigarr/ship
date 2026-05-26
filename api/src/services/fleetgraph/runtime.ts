import { randomUUID } from 'crypto';
import { pool } from '../../db/client.js';
import { extractText } from '../../utils/document-content.js';
import {
  extractHypothesisFromContent,
  extractSuccessCriteriaFromContent,
} from '../../utils/extractHypothesis.js';
import { createFleetGraphTrace } from './trace.js';
import type {
  FleetGraphBranch,
  FleetGraphContext,
  FleetGraphRunResult,
  FleetGraphSignal,
  FleetGraphTrigger,
} from './types.js';

interface DocumentRow {
  id: string;
  title: string | null;
  document_type: string;
  content: unknown;
  properties: Record<string, unknown> | null;
  updated_at: string;
}

const TOKEN_ESTIMATE_PER_SIGNAL = 3750;
const COST_PER_RUN_ESTIMATE_USD = 0.006;

export async function ensureFleetGraphTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fleetgraph_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      trigger TEXT NOT NULL,
      branch TEXT NOT NULL,
      trace_id TEXT NOT NULL,
      trace_url TEXT NOT NULL,
      latency_ms INTEGER NOT NULL,
      token_estimate INTEGER NOT NULL DEFAULT 0,
      cost_estimate_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
      run_input JSONB NOT NULL DEFAULT '{}'::jsonb,
      run_output JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fleetgraph_findings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      run_id UUID NOT NULL REFERENCES fleetgraph_runs(id) ON DELETE CASCADE,
      signal_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      confidence NUMERIC(4, 3) NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id UUID,
      evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
      dedupe_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, dedupe_key)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fleetgraph_hitl_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      finding_id UUID NOT NULL REFERENCES fleetgraph_findings(id) ON DELETE CASCADE,
      requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
      action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      decision_status TEXT NOT NULL DEFAULT 'pending',
      decision_by UUID REFERENCES users(id) ON DELETE SET NULL,
      decision_note TEXT,
      decision_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

function toIsoString(input: string): string {
  return new Date(input).toISOString();
}

function hoursSince(input: string): number {
  const updatedAt = new Date(input).getTime();
  const now = Date.now();
  return Math.max(0, (now - updatedAt) / (1000 * 60 * 60));
}

function normalizePrompt(prompt?: string): string {
  return (prompt ?? '').trim().toLowerCase();
}

async function fetchContextDocuments(context: FleetGraphContext): Promise<DocumentRow[]> {
  if (context.documentId) {
    const result = await pool.query<DocumentRow>(
      `SELECT id, title, document_type, content, properties, updated_at::text
       FROM documents
       WHERE id = $1
         AND workspace_id = $2
         AND deleted_at IS NULL`,
      [context.documentId, context.workspaceId]
    );
    return result.rows;
  }

  const result = await pool.query<DocumentRow>(
    `SELECT id, title, document_type, content, properties, updated_at::text
     FROM documents
     WHERE workspace_id = $1
       AND document_type IN ('issue', 'project', 'weekly_plan', 'weekly_retro')
       AND deleted_at IS NULL
     ORDER BY updated_at DESC
     LIMIT 50`,
    [context.workspaceId]
  );

  return result.rows;
}

function computeSignalBranch(signals: FleetGraphSignal[]): FleetGraphBranch {
  const top = signals[0];
  if (!top) return 'no_action';
  return top.type;
}

function buildDedupeKey(signal: FleetGraphSignal, workspaceId: string): string {
  const entity = signal.entityId ?? 'workspace';
  return `${workspaceId}:${signal.type}:${entity}:${signal.title}`;
}

function createSignalFromIssue(row: DocumentRow): FleetGraphSignal | null {
  const props = row.properties ?? {};
  const state = typeof props.state === 'string' ? props.state : '';
  const isClosed = state === 'done' || state === 'cancelled';
  if (isClosed) return null;

  const ageHours = hoursSince(row.updated_at);
  if (ageHours < 24) return null;

  const priority = typeof props.priority === 'string' ? props.priority : 'medium';
  const severity: FleetGraphSignal['severity'] =
    priority === 'urgent' || priority === 'high' ? 'high' : 'medium';

  return {
    type: 'execution_risk',
    severity,
    confidence: Math.min(0.95, 0.4 + ageHours / 72),
    title: row.title ? `Stale execution risk: ${row.title}` : 'Stale execution risk',
    summary: `Issue has not moved for ${Math.floor(ageHours)} hours and may require intervention.`,
    entityType: 'issue',
    entityId: row.id,
    evidence: [
      `issue_id:${row.id}`,
      `last_updated:${toIsoString(row.updated_at)}`,
      `priority:${priority}`,
    ],
    requiresHitl: false,
  };
}

function createSignalFromWeeklyPlan(row: DocumentRow): FleetGraphSignal | null {
  const planText = extractText(row.content).trim();
  if (!planText) {
    return {
      type: 'planning_risk',
      severity: 'high',
      confidence: 0.9,
      title: row.title ? `Weak plan quality: ${row.title}` : 'Weak plan quality',
      summary: 'Weekly plan appears empty or non-actionable.',
      entityType: 'weekly_plan',
      entityId: row.id,
      evidence: [`weekly_plan_id:${row.id}`, 'plan_text_length:0'],
      requiresHitl: false,
    };
  }

  if (planText.length > 0 && planText.length < 80) {
    return {
      type: 'planning_risk',
      severity: 'medium',
      confidence: 0.75,
      title: row.title ? `Weak plan quality: ${row.title}` : 'Weak plan quality',
      summary: 'Plan content is likely too short to define measurable outcomes.',
      entityType: 'weekly_plan',
      entityId: row.id,
      evidence: [`weekly_plan_id:${row.id}`, `plan_text_length:${planText.length}`],
      requiresHitl: false,
    };
  }

  return null;
}

function createSignalFromWeeklyRetro(row: DocumentRow): FleetGraphSignal | null {
  const retroText = extractText(row.content).trim();
  if (retroText.length >= 120) return null;

  return {
    type: 'evidence_risk',
    severity: retroText.length === 0 ? 'high' : 'medium',
    confidence: retroText.length === 0 ? 0.9 : 0.7,
    title: row.title ? `Evidence quality risk: ${row.title}` : 'Evidence quality risk',
    summary: 'Retro evidence appears incomplete for reviewer replayability.',
    entityType: 'weekly_retro',
    entityId: row.id,
    evidence: [`weekly_retro_id:${row.id}`, `retro_text_length:${retroText.length}`],
    requiresHitl: false,
  };
}

function createSignalFromProject(row: DocumentRow): FleetGraphSignal | null {
  const hypothesis = extractHypothesisFromContent(row.content)?.trim() ?? '';
  if (!hypothesis) return null;

  const successCriteria = extractSuccessCriteriaFromContent(row.content)?.trim() ?? '';
  if (successCriteria.length >= 20) return null;

  return {
    type: 'hypothesis_risk',
    severity: 'medium',
    confidence: successCriteria.length === 0 ? 0.85 : 0.7,
    title: row.title ? `Hypothesis drift: ${row.title}` : 'Hypothesis drift',
    summary:
      'Project hypothesis exists without measurable success criteria; PM review recommended before further execution.',
    entityType: 'project',
    entityId: row.id,
    evidence: [
      `project_id:${row.id}`,
      `hypothesis_length:${hypothesis.length}`,
      `success_criteria_length:${successCriteria.length}`,
    ],
    requiresHitl: false,
  };
}

function createComplianceSignal(context: FleetGraphContext, docs: DocumentRow[]): FleetGraphSignal | null {
  const prompt = normalizePrompt(context.prompt);
  if (!prompt.includes('compliance') && !prompt.includes('audit') && !prompt.includes('security')) {
    return null;
  }

  const related = docs[0];
  return {
    type: 'compliance_risk',
    severity: 'high',
    confidence: 0.72,
    title: 'Compliance-sensitive action requires confirmation',
    summary: 'Requested operation touches compliance-sensitive context and requires HITL confirmation.',
    entityType: related?.document_type === 'issue' ? 'issue' : 'workspace',
    entityId: related?.id ?? null,
    evidence: ['prompt_contains:compliance|audit|security'],
    requiresHitl: true,
  };
}

function detectSignals(context: FleetGraphContext, docs: DocumentRow[]): FleetGraphSignal[] {
  const signals: FleetGraphSignal[] = [];

  for (const row of docs) {
    if (row.document_type === 'issue') {
      const issueSignal = createSignalFromIssue(row);
      if (issueSignal) signals.push(issueSignal);
    }
    if (row.document_type === 'weekly_plan') {
      const planSignal = createSignalFromWeeklyPlan(row);
      if (planSignal) signals.push(planSignal);
    }
    if (row.document_type === 'weekly_retro') {
      const retroSignal = createSignalFromWeeklyRetro(row);
      if (retroSignal) signals.push(retroSignal);
    }
    if (row.document_type === 'project') {
      const projectSignal = createSignalFromProject(row);
      if (projectSignal) signals.push(projectSignal);
    }
  }

  const complianceSignal = createComplianceSignal(context, docs);
  if (complianceSignal) signals.push(complianceSignal);

  return signals.sort((a, b) => {
    const severityWeight = (value: FleetGraphSignal['severity']) =>
      value === 'high' ? 3 : value === 'medium' ? 2 : 1;
    const deltaSeverity = severityWeight(b.severity) - severityWeight(a.severity);
    if (deltaSeverity !== 0) return deltaSeverity;
    return b.confidence - a.confidence;
  });
}

async function upsertFinding(
  workspaceId: string,
  runId: string,
  signal: FleetGraphSignal
): Promise<{ id: string; status: 'open' | 'pending_approval' }> {
  const dedupeKey = buildDedupeKey(signal, workspaceId);
  const status = signal.requiresHitl ? 'pending_approval' : 'open';
  const result = await pool.query<{ id: string; status: 'open' | 'pending_approval' }>(
    `INSERT INTO fleetgraph_findings (
        workspace_id, run_id, signal_type, severity, confidence, title, summary,
        entity_type, entity_id, evidence, dedupe_key, status, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9::uuid, $10::jsonb, $11, $12, NOW()
      )
      ON CONFLICT (workspace_id, dedupe_key) DO UPDATE
      SET run_id = EXCLUDED.run_id,
          severity = EXCLUDED.severity,
          confidence = EXCLUDED.confidence,
          summary = EXCLUDED.summary,
          evidence = EXCLUDED.evidence,
          status = EXCLUDED.status,
          updated_at = NOW()
      RETURNING id, status`,
    [
      workspaceId,
      runId,
      signal.type,
      signal.severity,
      signal.confidence,
      signal.title,
      signal.summary,
      signal.entityType,
      signal.entityId,
      JSON.stringify(signal.evidence),
      dedupeKey,
      status,
    ]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to persist FleetGraph finding');
  }
  return row;
}

async function createHitlRequest(
  workspaceId: string,
  findingId: string,
  userId: string,
  signal: FleetGraphSignal
): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO fleetgraph_hitl_requests (
       workspace_id, finding_id, requested_by, action_payload, decision_status
     )
     VALUES ($1, $2, $3, $4::jsonb, 'pending')
     RETURNING id`,
    [
      workspaceId,
      findingId,
      userId,
      JSON.stringify({
        title: signal.title,
        summary: signal.summary,
        entityType: signal.entityType,
        entityId: signal.entityId,
        severity: signal.severity,
        confidence: signal.confidence,
      }),
    ]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to create FleetGraph HITL request');
  }
  return row.id;
}

function buildRunSummary(trigger: FleetGraphTrigger, signals: FleetGraphSignal[]): string {
  if (signals.length === 0) {
    return `FleetGraph (${trigger}) found no actionable signals.`;
  }

  const top = signals[0];
  if (!top) return `FleetGraph (${trigger}) completed.`;
  return `FleetGraph (${trigger}) surfaced ${signals.length} signal(s); highest priority is ${top.type} (${top.severity}).`;
}

export async function executeFleetGraphRun(
  trigger: FleetGraphTrigger,
  context: FleetGraphContext
): Promise<FleetGraphRunResult> {
  const startedAtMs = Date.now();
  const startedAtIso = new Date(startedAtMs).toISOString();

  await ensureFleetGraphTables();

  const docs = await fetchContextDocuments(context);
  const signals = detectSignals(context, docs);
  const branch = computeSignalBranch(signals);

  const tokenEstimate = signals.length === 0 ? 0 : TOKEN_ESTIMATE_PER_SIGNAL * signals.length;
  const costEstimateUsd = signals.length === 0 ? 0 : Number((COST_PER_RUN_ESTIMATE_USD * signals.length).toFixed(6));
  const latencyMs = Math.max(1, Date.now() - startedAtMs);

  const trace = createFleetGraphTrace({
    trigger,
    branch,
    workspaceId: context.workspaceId,
    userId: context.userId,
    latencyMs,
    tokenEstimate,
    costEstimateUsd,
  });

  const runId = randomUUID();
  const completedAtIso = new Date().toISOString();
  const summary = buildRunSummary(trigger, signals);

  await pool.query(
    `INSERT INTO fleetgraph_runs (
       id, workspace_id, user_id, trigger, branch, trace_id, trace_url,
       latency_ms, token_estimate, cost_estimate_usd, run_input, run_output
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7,
       $8, $9, $10, $11::jsonb, $12::jsonb
     )`,
    [
      runId,
      context.workspaceId,
      context.userId,
      trigger,
      branch,
      trace.traceId,
      trace.traceUrl,
      latencyMs,
      tokenEstimate,
      costEstimateUsd,
      JSON.stringify({
        documentId: context.documentId ?? null,
        documentType: context.documentType ?? null,
        prompt: context.prompt ?? null,
      }),
      JSON.stringify({
        signalCount: signals.length,
        branch,
        summary,
      }),
    ]
  );

  const findings: FleetGraphRunResult['findings'] = [];
  let hitlRequestId: string | undefined;

  for (const signal of signals) {
    const finding = await upsertFinding(context.workspaceId, runId, signal);
    findings.push({
      id: finding.id,
      status: finding.status,
      signal,
    });

    if (signal.requiresHitl && !hitlRequestId) {
      hitlRequestId = await createHitlRequest(context.workspaceId, finding.id, context.userId, signal);
    }
  }

  return {
    run: {
      runId,
      traceId: trace.traceId,
      traceUrl: trace.traceUrl,
      trigger,
      branch,
      startedAt: startedAtIso,
      completedAt: completedAtIso,
      latencyMs,
      tokenEstimate,
      costEstimateUsd,
    },
    signals,
    summary,
    findings,
    hitlRequestId,
  };
}

export async function listFleetGraphOpenFindings(workspaceId: string): Promise<Array<{
  id: string;
  status: string;
  signalType: string;
  severity: string;
  confidence: number;
  title: string;
  summary: string;
  traceUrl: string;
  updatedAt: string;
}>> {
  const result = await pool.query<{
    id: string;
    status: string;
    signal_type: string;
    severity: string;
    confidence: string;
    title: string;
    summary: string;
    trace_url: string;
    updated_at: string;
  }>(
    `SELECT
       f.id,
       f.status,
       f.signal_type,
       f.severity,
       f.confidence::text,
       f.title,
       f.summary,
       r.trace_url,
       f.updated_at::text
     FROM fleetgraph_findings f
     JOIN fleetgraph_runs r ON r.id = f.run_id
     WHERE f.workspace_id = $1
       AND f.status IN ('open', 'pending_approval', 'rejected')
     ORDER BY f.updated_at DESC
     LIMIT 100`,
    [workspaceId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    status: row.status,
    signalType: row.signal_type,
    severity: row.severity,
    confidence: Number(row.confidence),
    title: row.title,
    summary: row.summary,
    traceUrl: row.trace_url,
    updatedAt: toIsoString(row.updated_at),
  }));
}

export async function decideFleetGraphHitlRequest(
  workspaceId: string,
  requestId: string,
  decisionBy: string,
  approved: boolean,
  note?: string
): Promise<{ requestId: string; decisionStatus: 'approved' | 'rejected'; findingId: string }> {
  await ensureFleetGraphTables();

  const requestResult = await pool.query<{ id: string; finding_id: string; decision_status: string }>(
    `SELECT id, finding_id, decision_status
     FROM fleetgraph_hitl_requests
     WHERE id = $1
       AND workspace_id = $2`,
    [requestId, workspaceId]
  );

  const request = requestResult.rows[0];
  if (!request) {
    throw new Error('HITL request not found');
  }

  if (request.decision_status !== 'pending') {
    throw new Error('HITL request already decided');
  }

  const decisionStatus: 'approved' | 'rejected' = approved ? 'approved' : 'rejected';
  const findingStatus = approved ? 'resolved' : 'rejected';

  await pool.query(
    `UPDATE fleetgraph_hitl_requests
     SET decision_status = $1,
         decision_by = $2,
         decision_note = $3,
         decision_at = NOW()
     WHERE id = $4`,
    [decisionStatus, decisionBy, note ?? null, requestId]
  );

  await pool.query(
    `UPDATE fleetgraph_findings
     SET status = $1,
         updated_at = NOW()
     WHERE id = $2`,
    [findingStatus, request.finding_id]
  );

  return {
    requestId,
    decisionStatus,
    findingId: request.finding_id,
  };
}

export async function getFleetGraphMetrics(workspaceId: string): Promise<{
  runCount: number;
  avgLatencyMs: number;
  totalTokenEstimate: number;
  totalCostEstimateUsd: number;
  monthlyProjectionUsd: { users100: number; users1000: number; users10000: number };
  recentTraceUrls: string[];
}> {
  await ensureFleetGraphTables();

  const aggregateResult = await pool.query<{
    run_count: string;
    avg_latency_ms: string | null;
    total_tokens: string | null;
    total_cost: string | null;
  }>(
    `SELECT
       COUNT(*)::text AS run_count,
       AVG(latency_ms)::text AS avg_latency_ms,
       SUM(token_estimate)::text AS total_tokens,
       SUM(cost_estimate_usd)::text AS total_cost
     FROM fleetgraph_runs
     WHERE workspace_id = $1`,
    [workspaceId]
  );

  const recentTracesResult = await pool.query<{ trace_url: string }>(
    `SELECT trace_url
     FROM fleetgraph_runs
     WHERE workspace_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [workspaceId]
  );

  const row = aggregateResult.rows[0];
  const runCount = Number(row?.run_count ?? 0);
  const avgLatencyMs = Number(row?.avg_latency_ms ?? 0);
  const totalTokenEstimate = Number(row?.total_tokens ?? 0);
  const totalCostEstimateUsd = Number(row?.total_cost ?? 0);

  // Keep projections aligned with PRD reporting assumptions.
  const projectionPer100 = 440 * 30 * COST_PER_RUN_ESTIMATE_USD;
  const users100 = Number(projectionPer100.toFixed(2));
  const users1000 = Number((projectionPer100 * 10).toFixed(2));
  const users10000 = Number((projectionPer100 * 100).toFixed(2));

  return {
    runCount,
    avgLatencyMs,
    totalTokenEstimate,
    totalCostEstimateUsd,
    monthlyProjectionUsd: {
      users100,
      users1000,
      users10000,
    },
    recentTraceUrls: recentTracesResult.rows.map((entry) => entry.trace_url),
  };
}

export async function listFleetGraphRecentRuns(workspaceId: string): Promise<Array<{
  runId: string;
  trigger: string;
  branch: string;
  traceUrl: string;
  latencyMs: number;
  createdAt: string;
}>> {
  await ensureFleetGraphTables();

  const result = await pool.query<{
    id: string;
    trigger: string;
    branch: string;
    trace_url: string;
    latency_ms: number;
    created_at: string;
  }>(
    `SELECT id, trigger, branch, trace_url, latency_ms, created_at::text
     FROM fleetgraph_runs
     WHERE workspace_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [workspaceId]
  );

  return result.rows.map((row) => ({
    runId: row.id,
    trigger: row.trigger,
    branch: row.branch,
    traceUrl: row.trace_url,
    latencyMs: row.latency_ms,
    createdAt: toIsoString(row.created_at),
  }));
}
