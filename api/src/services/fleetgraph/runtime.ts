import { randomUUID } from 'crypto';
import { pool } from '../../db/client.js';
import { extractText } from '../../utils/document-content.js';
import {
  extractHypothesisFromContent,
  extractSuccessCriteriaFromContent,
} from '../../utils/extractHypothesis.js';
import { finishFleetGraphTrace, getFleetGraphTraceConfig, startFleetGraphTrace } from './trace.js';
import { buildHitlActionPayload, executeApprovedHitlAction, type HitlActionPayload } from './hitl-actions.js';
import { enrichSignalsWithNotificationDrafts } from './notifications.js';
import { synthesizeFleetGraphResponse } from './synthesis.js';
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

interface IssueExecutionContext {
  blockerAgeHours: number | null;
  blockerText: string | null;
  sprintEndWithinHours: number | null;
  assigneeMissingStandup: boolean;
}

type FleetGraphTracePhase =
  | 'start'
  | 'context'
  | 'detection'
  | 'synthesis'
  | 'branch'
  | 'persistence'
  | 'hitl'
  | 'complete';

interface FleetGraphTraceEventInput {
  phase: FleetGraphTracePhase;
  name: string;
  status: 'ok' | 'error';
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}

const TOKEN_ESTIMATE_PER_SIGNAL = 3750;
const COST_PER_RUN_ESTIMATE_USD = 0.006;
const DEFAULT_SNOOZE_HOURS = 24;
const MAX_SNOOZE_HOURS = 168;
const STANDUP_GAP_DAYS = 2;
const PRD_LATENCY_BUDGET_MS = 300_000;

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
    CREATE TABLE IF NOT EXISTS fleetgraph_trace_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      trace_id TEXT NOT NULL,
      run_id UUID REFERENCES fleetgraph_runs(id) ON DELETE CASCADE,
      phase TEXT NOT NULL,
      event_name TEXT NOT NULL,
      event_status TEXT NOT NULL,
      latency_ms INTEGER,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_fleetgraph_trace_events_workspace_trace_created
      ON fleetgraph_trace_events(workspace_id, trace_id, created_at ASC);
  `);

  await pool.query(`
    ALTER TABLE fleetgraph_findings
      ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS snoozed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS snooze_note TEXT,
      ADD COLUMN IF NOT EXISTS notification_drafts JSONB NOT NULL DEFAULT '[]'::jsonb;
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

async function persistFleetGraphTraceEvents(
  workspaceId: string,
  traceId: string,
  runId: string,
  events: FleetGraphTraceEventInput[]
): Promise<void> {
  if (events.length === 0) {
    return;
  }

  await pool.query(
    `INSERT INTO fleetgraph_trace_events (
       workspace_id, trace_id, run_id, phase, event_name, event_status, latency_ms, metadata
     )
     SELECT
       $1::uuid,
       $2::text,
       $3::uuid,
       item.phase::text,
       item.event_name::text,
       item.event_status::text,
       NULLIF(item.latency_ms, '')::int,
       COALESCE(item.metadata::jsonb, '{}'::jsonb)
     FROM jsonb_to_recordset($4::jsonb) AS item(
       phase text,
       event_name text,
       event_status text,
       latency_ms text,
       metadata jsonb
     )`,
    [
      workspaceId,
      traceId,
      runId,
      JSON.stringify(
        events.map((event) => ({
          phase: event.phase,
          event_name: event.name,
          event_status: event.status,
          latency_ms:
            typeof event.latencyMs === 'number' && Number.isFinite(event.latencyMs)
              ? String(Math.max(0, Math.round(event.latencyMs)))
              : '',
          metadata: event.metadata ?? {},
        }))
      ),
    ]
  );
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

function calculateSprintEndDate(
  sprintNumber: number,
  workspaceStartDate: string | Date
): Date {
  const sprintDuration = 7;
  let baseDate: Date;
  if (workspaceStartDate instanceof Date) {
    baseDate = new Date(
      Date.UTC(workspaceStartDate.getFullYear(), workspaceStartDate.getMonth(), workspaceStartDate.getDate())
    );
  } else {
    baseDate = new Date(`${workspaceStartDate}T00:00:00Z`);
  }

  const startDate = new Date(baseDate);
  startDate.setUTCDate(startDate.getUTCDate() + (sprintNumber - 1) * sprintDuration);
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + sprintDuration - 1);
  endDate.setUTCHours(23, 59, 59, 999);
  return endDate;
}

function hoursUntil(date: Date): number {
  return Math.max(0, (date.getTime() - Date.now()) / (1000 * 60 * 60));
}

function getCurrentSprintNumber(workspaceStartDate: string | Date): number {
  const sprintDuration = 7;
  let baseDate: Date;
  if (workspaceStartDate instanceof Date) {
    baseDate = new Date(
      Date.UTC(workspaceStartDate.getFullYear(), workspaceStartDate.getMonth(), workspaceStartDate.getDate())
    );
  } else {
    baseDate = new Date(`${workspaceStartDate}T00:00:00Z`);
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const daysSinceStart = Math.floor((today.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
  return Math.floor(daysSinceStart / sprintDuration) + 1;
}

function getSprintStartDate(sprintNumber: number, workspaceStartDate: string | Date): Date {
  const sprintDuration = 7;
  let baseDate: Date;
  if (workspaceStartDate instanceof Date) {
    baseDate = new Date(
      Date.UTC(workspaceStartDate.getFullYear(), workspaceStartDate.getMonth(), workspaceStartDate.getDate())
    );
  } else {
    baseDate = new Date(`${workspaceStartDate}T00:00:00Z`);
  }

  const startDate = new Date(baseDate);
  startDate.setUTCDate(startDate.getUTCDate() + (sprintNumber - 1) * sprintDuration);
  return startDate;
}

function daysBetweenUtc(start: Date, end: Date): number {
  const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24));
}

function shouldRunProactiveAccountabilityScan(context: FleetGraphContext): boolean {
  if (!context.documentId) {
    return true;
  }
  return context.documentType === 'sprint';
}

async function fetchIssueExecutionContexts(
  workspaceId: string,
  issueRows: DocumentRow[]
): Promise<Map<string, IssueExecutionContext>> {
  const contexts = new Map<string, IssueExecutionContext>();
  const issueIds = issueRows.map((row) => row.id);
  if (issueIds.length === 0) {
    return contexts;
  }

  for (const issueId of issueIds) {
    contexts.set(issueId, {
      blockerAgeHours: null,
      blockerText: null,
      sprintEndWithinHours: null,
      assigneeMissingStandup: false,
    });
  }

  const blockersResult = await pool.query<{
    issue_id: string;
    blockers_encountered: string;
    created_at: string;
  }>(
    `SELECT DISTINCT ON (issue_id)
       issue_id,
       blockers_encountered,
       created_at::text
     FROM issue_iterations
     WHERE workspace_id = $1
       AND issue_id = ANY($2::uuid[])
       AND blockers_encountered IS NOT NULL
       AND TRIM(blockers_encountered) <> ''
     ORDER BY issue_id, created_at DESC`,
    [workspaceId, issueIds]
  );

  for (const row of blockersResult.rows) {
    const ctx = contexts.get(row.issue_id);
    if (!ctx) continue;
    ctx.blockerAgeHours = hoursSince(row.created_at);
    ctx.blockerText = row.blockers_encountered;
  }

  const sprintResult = await pool.query<{
    issue_id: string;
    sprint_id: string;
    sprint_number: number | null;
    assignee_id: string | null;
  }>(
    `SELECT
       da.document_id AS issue_id,
       sprint.id AS sprint_id,
       (sprint.properties->>'sprint_number')::int AS sprint_number,
       issue.properties->>'assignee_id' AS assignee_id
     FROM document_associations da
     JOIN documents sprint
       ON sprint.id = da.related_id
      AND sprint.document_type = 'sprint'
      AND sprint.deleted_at IS NULL
     JOIN documents issue
       ON issue.id = da.document_id
     WHERE da.document_id = ANY($1::uuid[])
       AND da.relationship_type = 'sprint'`,
    [issueIds]
  );

  if (sprintResult.rows.length === 0) {
    return contexts;
  }

  const workspaceResult = await pool.query<{ sprint_start_date: string | Date | null }>(
    `SELECT sprint_start_date FROM workspaces WHERE id = $1`,
    [workspaceId]
  );
  const workspaceStartDate = workspaceResult.rows[0]?.sprint_start_date;
  if (!workspaceStartDate) {
    return contexts;
  }

  for (const row of sprintResult.rows) {
    const ctx = contexts.get(row.issue_id);
    if (!ctx || !row.sprint_number) continue;

    const sprintEnd = calculateSprintEndDate(row.sprint_number, workspaceStartDate);
    ctx.sprintEndWithinHours = hoursUntil(sprintEnd);

    if (!row.assignee_id) {
      continue;
    }

    const standupResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM documents standup
       WHERE standup.workspace_id = $1
         AND standup.document_type = 'standup'
         AND standup.deleted_at IS NULL
         AND standup.parent_id = $2
         AND (standup.properties->>'author_id') = $3
         AND standup.updated_at >= NOW() - INTERVAL '2 days'`,
      [workspaceId, row.sprint_id, row.assignee_id]
    );

    ctx.assigneeMissingStandup = Number(standupResult.rows[0]?.count ?? 0) === 0;
  }

  return contexts;
}

async function fetchProactiveAccountabilitySignals(workspaceId: string): Promise<FleetGraphSignal[]> {
  const signals: FleetGraphSignal[] = [];

  const workspaceResult = await pool.query<{ sprint_start_date: string | Date | null }>(
    `SELECT sprint_start_date FROM workspaces WHERE id = $1`,
    [workspaceId]
  );
  const workspaceStartDate = workspaceResult.rows[0]?.sprint_start_date;
  if (!workspaceStartDate) {
    return signals;
  }

  const currentSprintNumber = getCurrentSprintNumber(workspaceStartDate);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const assigneeRows = await pool.query<{
    sprint_id: string;
    sprint_title: string | null;
    assignee_id: string;
    issue_count: string;
  }>(
    `SELECT
       s.id AS sprint_id,
       s.title AS sprint_title,
       i.properties->>'assignee_id' AS assignee_id,
       COUNT(i.id)::text AS issue_count
     FROM documents i
     JOIN document_associations da
       ON da.document_id = i.id
      AND da.relationship_type = 'sprint'
     JOIN documents s
       ON s.id = da.related_id
      AND s.document_type = 'sprint'
      AND s.deleted_at IS NULL
     WHERE i.workspace_id = $1
       AND i.document_type = 'issue'
       AND i.deleted_at IS NULL
       AND COALESCE(i.properties->>'state', '') NOT IN ('done', 'cancelled')
       AND i.properties->>'assignee_id' IS NOT NULL
       AND (s.properties->>'sprint_number')::int = $2
     GROUP BY s.id, s.title, assignee_id`,
    [workspaceId, currentSprintNumber]
  );

  for (const row of assigneeRows.rows) {
    const recentStandupResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM documents
       WHERE workspace_id = $1
         AND document_type = 'standup'
         AND deleted_at IS NULL
         AND parent_id = $2
         AND (properties->>'author_id') = $3
         AND updated_at >= NOW() - ($4 || ' days')::interval`,
      [workspaceId, row.sprint_id, row.assignee_id, String(STANDUP_GAP_DAYS)]
    );

    if (Number(recentStandupResult.rows[0]?.count ?? 0) > 0) {
      continue;
    }

    const lastStandupResult = await pool.query<{ last_standup: string | null }>(
      `SELECT MAX(updated_at)::text AS last_standup
       FROM documents
       WHERE workspace_id = $1
         AND document_type = 'standup'
         AND deleted_at IS NULL
         AND parent_id = $2
         AND (properties->>'author_id') = $3`,
      [workspaceId, row.sprint_id, row.assignee_id]
    );

    const lastStandup = lastStandupResult.rows[0]?.last_standup;
    const daysSinceLastStandup = lastStandup
      ? daysBetweenUtc(new Date(lastStandup), today)
      : STANDUP_GAP_DAYS + 1;

    if (daysSinceLastStandup < STANDUP_GAP_DAYS) {
      continue;
    }

    const sprintTitle = row.sprint_title ?? `Sprint ${currentSprintNumber}`;
    const issueCount = Number(row.issue_count);

    signals.push({
      type: 'accountability_risk',
      severity: daysSinceLastStandup >= 3 ? 'high' : 'medium',
      confidence: Math.min(0.95, 0.65 + daysSinceLastStandup / 10),
      title: `Missing standup accountability: ${sprintTitle} (${row.assignee_id})`,
      summary: `Assignee has no standup update in the last ${STANDUP_GAP_DAYS} days for an active sprint with ${issueCount} open issue(s).`,
      entityType: 'sprint',
      entityId: row.sprint_id,
      evidence: [
        `sprint_id:${row.sprint_id}`,
        `assignee_id:${row.assignee_id}`,
        `days_since_last_standup:${daysSinceLastStandup}`,
        `issue_count:${issueCount}`,
      ],
      requiresHitl: false,
    });
  }

  const sprintRows = await pool.query<{
    id: string;
    title: string | null;
    sprint_number: number;
    plan_approval: { state?: string | null } | null;
    review_approval: { state?: string | null } | null;
    has_plan: boolean;
    has_retro: boolean;
  }>(
    `SELECT
       s.id,
       s.title,
       (s.properties->>'sprint_number')::int AS sprint_number,
       s.properties->'plan_approval' AS plan_approval,
       s.properties->'review_approval' AS review_approval,
       EXISTS (
         SELECT 1 FROM documents pl
         WHERE pl.workspace_id = s.workspace_id
           AND pl.document_type = 'weekly_plan'
           AND (pl.properties->>'week_number')::int = (s.properties->>'sprint_number')::int
           AND pl.deleted_at IS NULL
       ) AS has_plan,
       EXISTS (
         SELECT 1 FROM documents rt
         WHERE rt.workspace_id = s.workspace_id
           AND rt.document_type = 'weekly_retro'
           AND (rt.properties->>'week_number')::int = (s.properties->>'sprint_number')::int
           AND rt.deleted_at IS NULL
       ) AS has_retro
     FROM documents s
     WHERE s.workspace_id = $1
       AND s.document_type = 'sprint'
       AND s.deleted_at IS NULL
       AND (s.properties->>'sprint_number')::int <= $2`,
    [workspaceId, currentSprintNumber]
  );

  for (const sprint of sprintRows.rows) {
    const sprintStart = getSprintStartDate(sprint.sprint_number, workspaceStartDate);
    const daysIntoSprint = daysBetweenUtc(sprintStart, today);
    const daysSinceSprintEnd = daysBetweenSprintEnd(sprint.sprint_number, workspaceStartDate, today);

    const planApprovalState = sprint.plan_approval?.state ?? null;
    if (
      sprint.sprint_number === currentSprintNumber &&
      sprint.has_plan &&
      (planApprovalState === null || planApprovalState === undefined)
    ) {
      const daysOverdue = Math.max(0, daysIntoSprint - 1);
      if (daysOverdue >= 2) {
        const sprintTitle = sprint.title ?? `Sprint ${sprint.sprint_number}`;
        signals.push({
          type: 'planning_risk',
          severity: daysOverdue >= 3 ? 'high' : 'medium',
          confidence: Math.min(0.92, 0.7 + daysOverdue / 10),
          title: `Overdue plan approval: ${sprintTitle}`,
          summary: `Weekly plan was submitted but manager approval is still pending ${daysOverdue} day(s) into the sprint.`,
          entityType: 'sprint',
          entityId: sprint.id,
          evidence: [
            `approval_type:plan`,
            `sprint_id:${sprint.id}`,
            `days_overdue:${daysOverdue}`,
            `approval_state:null`,
          ],
          requiresHitl: false,
        });
      }
    }

    const reviewApprovalState = sprint.review_approval?.state ?? null;
    if (
      sprint.has_retro &&
      (reviewApprovalState === null || reviewApprovalState === undefined) &&
      daysSinceSprintEnd >= 2
    ) {
      const sprintTitle = sprint.title ?? `Sprint ${sprint.sprint_number}`;
      signals.push({
        type: 'planning_risk',
        severity: daysSinceSprintEnd >= 4 ? 'high' : 'medium',
        confidence: Math.min(0.9, 0.68 + daysSinceSprintEnd / 12),
        title: `Overdue review approval: ${sprintTitle}`,
        summary: `Retro was submitted but review approval is still pending ${daysSinceSprintEnd} day(s) after sprint end.`,
        entityType: 'sprint',
        entityId: sprint.id,
        evidence: [
          `approval_type:review`,
          `sprint_id:${sprint.id}`,
          `days_overdue:${daysSinceSprintEnd}`,
          `approval_state:null`,
        ],
        requiresHitl: false,
      });
    }
  }

  return signals;
}

function daysBetweenSprintEnd(
  sprintNumber: number,
  workspaceStartDate: string | Date,
  today: Date
): number {
  const sprintEnd = calculateSprintEndDate(sprintNumber, workspaceStartDate);
  const endDay = new Date(
    Date.UTC(sprintEnd.getUTCFullYear(), sprintEnd.getUTCMonth(), sprintEnd.getUTCDate())
  );
  return daysBetweenUtc(endDay, today);
}

async function fetchRelatedGraphDocuments(
  workspaceId: string,
  documentId: string,
  documentType?: string
): Promise<DocumentRow[]> {
  const relatedIds = new Set<string>([documentId]);

  const associationResult = await pool.query<{ related_id: string; document_id: string }>(
    `SELECT document_id, related_id
     FROM document_associations
     WHERE (document_id = $1 OR related_id = $1)`,
    [documentId]
  );

  for (const row of associationResult.rows) {
    relatedIds.add(row.document_id);
    relatedIds.add(row.related_id);
  }

  if (documentType === 'issue' || documentType === 'project') {
    const sprintResult = await pool.query<{ sprint_id: string }>(
      `SELECT sprint.id AS sprint_id
       FROM document_associations da
       JOIN documents sprint
         ON sprint.id = da.related_id
        AND sprint.document_type = 'sprint'
        AND sprint.deleted_at IS NULL
       WHERE da.document_id = $1
         AND da.relationship_type = 'sprint'`,
      [documentId]
    );

    for (const row of sprintResult.rows) {
      relatedIds.add(row.sprint_id);
    }
  }

  const parentResult = await pool.query<{ parent_id: string | null }>(
    `SELECT parent_id FROM documents WHERE id = $1 AND workspace_id = $2`,
    [documentId, workspaceId]
  );
  const parentId = parentResult.rows[0]?.parent_id;
  if (parentId) {
    relatedIds.add(parentId);
  }

  const standupResult = await pool.query<{ id: string }>(
    `SELECT id
     FROM documents
     WHERE workspace_id = $1
       AND document_type = 'standup'
       AND deleted_at IS NULL
       AND (parent_id = ANY($2::uuid[]) OR id = ANY($2::uuid[]))
     ORDER BY updated_at DESC
     LIMIT 10`,
    [workspaceId, [...relatedIds]]
  );

  for (const row of standupResult.rows) {
    relatedIds.add(row.id);
  }

  const retroResult = await pool.query<{ id: string }>(
    `SELECT id
     FROM documents
     WHERE workspace_id = $1
       AND document_type IN ('weekly_retro', 'weekly_plan')
       AND deleted_at IS NULL
       AND (parent_id = ANY($2::uuid[]) OR id = ANY($2::uuid[]))
     ORDER BY updated_at DESC
     LIMIT 10`,
    [workspaceId, [...relatedIds]]
  );

  for (const row of retroResult.rows) {
    relatedIds.add(row.id);
  }

  const result = await pool.query<DocumentRow>(
    `SELECT id, title, document_type, content, properties, updated_at::text
     FROM documents
     WHERE workspace_id = $1
       AND id = ANY($2::uuid[])
       AND deleted_at IS NULL
     ORDER BY updated_at DESC`,
    [workspaceId, [...relatedIds]]
  );

  return result.rows;
}

async function fetchContextDocuments(context: FleetGraphContext): Promise<DocumentRow[]> {
  if (context.documentId) {
    const related = await fetchRelatedGraphDocuments(
      context.workspaceId,
      context.documentId,
      context.documentType
    );

    if (context.documentType) {
      const primary = related.filter((row) => row.id === context.documentId);
      const scopedType = related.filter(
        (row) => row.document_type === context.documentType && row.id !== context.documentId
      );
      const graphContext = related.filter((row) =>
        ['issue', 'project', 'weekly_plan', 'weekly_retro', 'standup', 'sprint'].includes(
          row.document_type
        )
      );

      const merged = new Map<string, DocumentRow>();
      for (const row of [...primary, ...scopedType, ...graphContext]) {
        merged.set(row.id, row);
      }
      return [...merged.values()];
    }

    return related;
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

function createSignalFromIssue(
  row: DocumentRow,
  executionContext?: IssueExecutionContext
): FleetGraphSignal | null {
  const props = row.properties ?? {};
  const state = typeof props.state === 'string' ? props.state : '';
  const isClosed = state === 'done' || state === 'cancelled';
  if (isClosed) return null;

  const ageHours = hoursSince(row.updated_at);
  const blockerAgeHours = executionContext?.blockerAgeHours ?? null;
  const hasStaleIssue = ageHours >= 24;
  const hasOpenBlocker = blockerAgeHours !== null && blockerAgeHours >= 24;
  if (!hasStaleIssue && !hasOpenBlocker) return null;

  const priority = typeof props.priority === 'string' ? props.priority : 'medium';
  let severity: FleetGraphSignal['severity'] =
    priority === 'urgent' || priority === 'high' ? 'high' : 'medium';
  let confidence = Math.min(0.95, 0.4 + Math.max(ageHours, blockerAgeHours ?? 0) / 72);

  const evidence = [
    `issue_id:${row.id}`,
    `last_updated:${toIsoString(row.updated_at)}`,
    `priority:${priority}`,
  ];

  const summaryParts: string[] = [];
  if (hasStaleIssue) {
    summaryParts.push(`Issue has not moved for ${Math.floor(ageHours)} hours`);
  }
  if (hasOpenBlocker) {
    evidence.push(`blocker_age_hours:${Math.floor(blockerAgeHours!)}`);
    if (executionContext?.blockerText) {
      evidence.push(`blocker:${executionContext.blockerText.slice(0, 120)}`);
    }
    summaryParts.push(
      `open blocker has been reported for ${Math.floor(blockerAgeHours!)} hours`
    );
  }
  if (
    executionContext &&
    executionContext.sprintEndWithinHours !== null &&
    executionContext.sprintEndWithinHours <= 48
  ) {
    evidence.push(`sprint_end_within_hours:${Math.floor(executionContext.sprintEndWithinHours)}`);
    severity = 'high';
    confidence = Math.max(confidence, 0.88);
    summaryParts.push('sprint end is within 48 hours');
  }
  if (executionContext?.assigneeMissingStandup) {
    evidence.push('assignee_missing_recent_standup:true');
    severity = 'high';
    confidence = Math.max(confidence, 0.85);
    summaryParts.push('assignee has no standup update in the last 2 days');
  }

  const titlePrefix = hasOpenBlocker ? 'Open blocker execution risk' : 'Stale execution risk';

  return {
    type: 'execution_risk',
    severity,
    confidence,
    title: row.title ? `${titlePrefix}: ${row.title}` : titlePrefix,
    summary: `${summaryParts.join('; ')}; manager or owner follow-up recommended.`,
    entityType: 'issue',
    entityId: row.id,
    evidence,
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

async function detectSignals(
  context: FleetGraphContext,
  docs: DocumentRow[]
): Promise<FleetGraphSignal[]> {
  const signals: FleetGraphSignal[] = [];
  const issueRows = docs.filter((row) => row.document_type === 'issue');
  const issueExecutionContexts = await fetchIssueExecutionContexts(context.workspaceId, issueRows);

  for (const row of docs) {
    if (row.document_type === 'issue') {
      const issueSignal = createSignalFromIssue(row, issueExecutionContexts.get(row.id));
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

  if (shouldRunProactiveAccountabilityScan(context)) {
    const accountabilitySignals = await fetchProactiveAccountabilitySignals(context.workspaceId);
    signals.push(...accountabilitySignals);
  }

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
): Promise<{ id: string; status: 'open' | 'pending_approval' | 'snoozed' }> {
  const dedupeKey = buildDedupeKey(signal, workspaceId);
  const status = signal.requiresHitl ? 'pending_approval' : 'open';
  const result = await pool.query<{ id: string; status: 'open' | 'pending_approval' | 'snoozed' }>(
    `INSERT INTO fleetgraph_findings (
        workspace_id, run_id, signal_type, severity, confidence, title, summary,
        entity_type, entity_id, evidence, dedupe_key, status, notification_drafts, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9::uuid, $10::jsonb, $11, $12, $13::jsonb, NOW()
      )
      ON CONFLICT (workspace_id, dedupe_key) DO UPDATE
      SET run_id = EXCLUDED.run_id,
          severity = EXCLUDED.severity,
          confidence = EXCLUDED.confidence,
          summary = EXCLUDED.summary,
          evidence = EXCLUDED.evidence,
          notification_drafts = EXCLUDED.notification_drafts,
          status = CASE
            WHEN fleetgraph_findings.status = 'snoozed'
                 AND fleetgraph_findings.snoozed_until IS NOT NULL
                 AND fleetgraph_findings.snoozed_until > NOW()
              THEN fleetgraph_findings.status
            ELSE EXCLUDED.status
          END,
          snoozed_until = CASE
            WHEN fleetgraph_findings.status = 'snoozed'
                 AND fleetgraph_findings.snoozed_until IS NOT NULL
                 AND fleetgraph_findings.snoozed_until > NOW()
              THEN fleetgraph_findings.snoozed_until
            ELSE NULL
          END,
          snoozed_by = CASE
            WHEN fleetgraph_findings.status = 'snoozed'
                 AND fleetgraph_findings.snoozed_until IS NOT NULL
                 AND fleetgraph_findings.snoozed_until > NOW()
              THEN fleetgraph_findings.snoozed_by
            ELSE NULL
          END,
          snooze_note = CASE
            WHEN fleetgraph_findings.status = 'snoozed'
                 AND fleetgraph_findings.snoozed_until IS NOT NULL
                 AND fleetgraph_findings.snoozed_until > NOW()
              THEN fleetgraph_findings.snooze_note
            ELSE NULL
          END,
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
      JSON.stringify(signal.notificationDrafts ?? []),
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
      JSON.stringify(buildHitlActionPayload(signal)),
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
  const traceEvents: FleetGraphTraceEventInput[] = [];
  const markEvent = (
    phase: FleetGraphTracePhase,
    name: string,
    status: 'ok' | 'error',
    metadata?: Record<string, unknown>,
    phaseStartedAtMs?: number
  ): void => {
    traceEvents.push({
      phase,
      name,
      status,
      latencyMs:
        typeof phaseStartedAtMs === 'number' && Number.isFinite(phaseStartedAtMs)
          ? Math.max(0, Date.now() - phaseStartedAtMs)
          : undefined,
      metadata,
    });
  };

  await ensureFleetGraphTables();

  const traceStartPhaseMs = Date.now();
  const traceStart = await startFleetGraphTrace({
    trigger,
    workspaceId: context.workspaceId,
    userId: context.userId,
    context: {
      documentId: context.documentId,
      documentType: context.documentType,
      prompt: context.prompt,
    },
  });
  markEvent(
    'start',
    'trace_started',
    'ok',
    {
      trigger,
      documentId: context.documentId ?? null,
      documentType: context.documentType ?? null,
      hasPrompt: Boolean(context.prompt?.trim()),
    },
    traceStartPhaseMs
  );

  const contextPhaseMs = Date.now();
  const docs = await fetchContextDocuments(context);
  markEvent(
    'context',
    'documents_loaded',
    'ok',
    {
      documentCount: docs.length,
      contextDocumentId: context.documentId ?? null,
      contextDocumentType: context.documentType ?? null,
    },
    contextPhaseMs
  );
  const detectionPhaseMs = Date.now();
  let signals = await detectSignals(context, docs);
  markEvent(
    'detection',
    'signals_detected',
    'ok',
    {
      signalCount: signals.length,
      signalTypes: [...new Set(signals.map((signal) => signal.type))],
    },
    detectionPhaseMs
  );
  signals = enrichSignalsWithNotificationDrafts(signals);
  const branch = computeSignalBranch(signals);
  const signalTypes = [...new Set(signals.map((signal) => signal.type))];
  markEvent(
    'branch',
    'branch_selected',
    'ok',
    {
      branch,
      signalCount: signals.length,
      signalTypes,
    },
    detectionPhaseMs
  );

  const fallbackSummary = buildRunSummary(trigger, signals);
  let summary = fallbackSummary;
  let tokenEstimate =
    signals.length === 0 ? 0 : TOKEN_ESTIMATE_PER_SIGNAL * signals.length;
  let costEstimateUsd =
    signals.length === 0 ? 0 : Number((COST_PER_RUN_ESTIMATE_USD * signals.length).toFixed(6));
  let synthesized = false;

  if (trigger === 'on_demand' && signals.length > 0) {
    const synthesisPhaseMs = Date.now();
    const synthesis = await synthesizeFleetGraphResponse({
      prompt: context.prompt,
      signals,
      context,
      fallbackSummary,
    });
    summary = synthesis.summary;
    if (synthesis.synthesized) {
      tokenEstimate = synthesis.inputTokens + synthesis.outputTokens;
      costEstimateUsd = synthesis.costEstimateUsd;
      synthesized = true;
    }
    markEvent(
      'synthesis',
      'response_synthesized',
      'ok',
      {
        synthesized: synthesis.synthesized,
        inputTokens: synthesis.inputTokens,
        outputTokens: synthesis.outputTokens,
        usedFallbackSummary: !synthesis.synthesized,
      },
      synthesisPhaseMs
    );
  }

  const latencyMs = Math.max(1, Date.now() - startedAtMs);

  const traceFinishPhaseMs = Date.now();
  const trace = await finishFleetGraphTrace({
    traceId: traceStart.traceId,
    trigger,
    branch,
    workspaceId: context.workspaceId,
    userId: context.userId,
    latencyMs,
    tokenEstimate,
    costEstimateUsd,
    signalTypes,
    signalCount: signals.length,
    summary,
  });
  markEvent(
    'complete',
    'trace_completed',
    'ok',
    {
      traceId: trace.traceId,
      traceUrl: trace.traceUrl,
      withinPrdLatencyBudget: latencyMs < PRD_LATENCY_BUDGET_MS,
    },
    traceFinishPhaseMs
  );

  const runId = randomUUID();
  const completedAtIso = new Date().toISOString();

  const persistencePhaseMs = Date.now();
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
        signalTypes,
        branch,
        summary,
        synthesized,
      }),
    ]
  );
  markEvent(
    'persistence',
    'run_persisted',
    'ok',
    {
      runId,
      signalCount: signals.length,
      tokenEstimate,
      costEstimateUsd,
    },
    persistencePhaseMs
  );

  const findings: FleetGraphRunResult['findings'] = [];
  let hitlRequestId: string | undefined;

  const findingsPhaseMs = Date.now();
  for (const signal of signals) {
    const finding = await upsertFinding(context.workspaceId, runId, signal);
    findings.push({
      id: finding.id,
      status: finding.status,
      signal,
    });

    if (signal.requiresHitl && !hitlRequestId) {
      hitlRequestId = await createHitlRequest(context.workspaceId, finding.id, context.userId, signal);
      markEvent('hitl', 'hitl_request_created', 'ok', {
        findingId: finding.id,
        signalType: signal.type,
      });
    }
  }
  markEvent(
    'persistence',
    'findings_persisted',
    'ok',
    {
      findingCount: findings.length,
      hitlRequestCreated: Boolean(hitlRequestId),
    },
    findingsPhaseMs
  );

  await persistFleetGraphTraceEvents(context.workspaceId, trace.traceId, runId, traceEvents);

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

export async function listFleetGraphOpenFindings(
  workspaceId: string,
  entityId?: string
): Promise<Array<{
  id: string;
  status: string;
  signalType: string;
  severity: string;
  confidence: number;
  title: string;
  summary: string;
  traceUrl: string;
  updatedAt: string;
  snoozedUntil: string | null;
  evidence: string[];
  entityType: string;
  entityId: string | null;
  hitlRequestId: string | null;
  notificationDrafts: Array<{ role: string; reason: string }>;
}>> {
  const params: string[] = [workspaceId];
  let entityFilter = '';
  if (entityId) {
    params.push(entityId);
    entityFilter = `AND f.entity_id = $${params.length}::uuid`;
  }

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
    snoozed_until: string | null;
    evidence: string[] | string;
    entity_type: string;
    entity_id: string | null;
    hitl_request_id: string | null;
    notification_drafts: Array<{ role: string; reason: string }> | string;
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
       f.updated_at::text,
       f.snoozed_until::text,
       f.evidence,
       f.entity_type,
       f.entity_id::text,
       f.notification_drafts,
       h.id::text AS hitl_request_id
     FROM fleetgraph_findings f
     JOIN fleetgraph_runs r ON r.id = f.run_id
     LEFT JOIN fleetgraph_hitl_requests h
       ON h.finding_id = f.id
      AND h.decision_status = 'pending'
     WHERE f.workspace_id = $1
       AND f.status IN ('open', 'pending_approval', 'rejected')
       AND NOT (f.status = 'snoozed' AND f.snoozed_until IS NOT NULL AND f.snoozed_until > NOW())
       ${entityFilter}
     ORDER BY f.updated_at DESC
     LIMIT 100`,
    params
  );

  return result.rows.map((row) => {
    const evidence =
      Array.isArray(row.evidence)
        ? row.evidence
        : typeof row.evidence === 'string'
          ? (JSON.parse(row.evidence) as string[])
          : [];
    const notificationDrafts =
      Array.isArray(row.notification_drafts)
        ? row.notification_drafts
        : typeof row.notification_drafts === 'string'
          ? (JSON.parse(row.notification_drafts) as Array<{ role: string; reason: string }>)
          : [];

    return {
      id: row.id,
      status: row.status,
      signalType: row.signal_type,
      severity: row.severity,
      confidence: Number(row.confidence),
      title: row.title,
      summary: row.summary,
      traceUrl: row.trace_url,
      updatedAt: toIsoString(row.updated_at),
      snoozedUntil: row.snoozed_until ? toIsoString(row.snoozed_until) : null,
      evidence,
      entityType: row.entity_type,
      entityId: row.entity_id,
      hitlRequestId: row.hitl_request_id,
      notificationDrafts,
    };
  });
}

export async function snoozeFleetGraphFinding(
  workspaceId: string,
  findingId: string,
  userId: string,
  hours: number = DEFAULT_SNOOZE_HOURS,
  note?: string
): Promise<{ findingId: string; status: 'snoozed'; snoozedUntil: string }> {
  await ensureFleetGraphTables();

  const clampedHours = Math.min(Math.max(hours, 1), MAX_SNOOZE_HOURS);
  const snoozedUntil = new Date(Date.now() + clampedHours * 60 * 60 * 1000);

  const result = await pool.query<{ id: string; snoozed_until: string }>(
    `UPDATE fleetgraph_findings
     SET status = 'snoozed',
         snoozed_until = $1,
         snoozed_by = $2,
         snooze_note = $3,
         updated_at = NOW()
     WHERE id = $4
       AND workspace_id = $5
       AND status IN ('open', 'pending_approval', 'rejected')
     RETURNING id, snoozed_until::text`,
    [snoozedUntil.toISOString(), userId, note ?? null, findingId, workspaceId]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('Finding not found or cannot be snoozed');
  }

  return {
    findingId: row.id,
    status: 'snoozed',
    snoozedUntil: toIsoString(row.snoozed_until),
  };
}

export async function decideFleetGraphHitlRequest(
  workspaceId: string,
  requestId: string,
  decisionBy: string,
  approved: boolean,
  note?: string
): Promise<{
  requestId: string;
  decisionStatus: 'approved' | 'rejected';
  findingId: string;
  actionExecuted?: boolean;
  actionDetail?: string;
}> {
  await ensureFleetGraphTables();

  const requestResult = await pool.query<{
    id: string;
    finding_id: string;
    decision_status: string;
    action_payload: HitlActionPayload | string;
  }>(
    `SELECT id, finding_id, decision_status, action_payload
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

  let actionExecuted: boolean | undefined;
  let actionDetail: string | undefined;

  if (approved) {
    const payload =
      typeof request.action_payload === 'string'
        ? (JSON.parse(request.action_payload) as HitlActionPayload)
        : request.action_payload;
    const execution = await executeApprovedHitlAction(workspaceId, decisionBy, payload);
    actionExecuted = execution.executed;
    actionDetail = execution.detail;
  }

  return {
    requestId,
    decisionStatus,
    findingId: request.finding_id,
    actionExecuted,
    actionDetail,
  };
}

export async function getFleetGraphMetrics(workspaceId: string): Promise<{
  runCount: number;
  avgLatencyMs: number;
  totalTokenEstimate: number;
  totalCostEstimateUsd: number;
  monthlyProjectionUsd: { users100: number; users1000: number; users10000: number };
  recentTraceUrls: string[];
  traceConfig: ReturnType<typeof getFleetGraphTraceConfig>;
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
    traceConfig: getFleetGraphTraceConfig(),
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

export async function getFleetGraphTraceDetail(
  workspaceId: string,
  traceId: string
): Promise<{
  traceId: string;
  traceUrl: string;
  run: {
    runId: string;
    trigger: string;
    branch: string;
    latencyMs: number;
    tokenEstimate: number;
    costEstimateUsd: number;
    createdAt: string;
    runInput: Record<string, unknown>;
    runOutput: Record<string, unknown>;
  };
  observability: {
    latencyBudgetMs: number;
    withinLatencyBudget: boolean;
    signalCount: number;
    signalTypes: string[];
    branchDivergenceMarker: string;
    hitlPendingCount: number;
  };
  timeline: Array<{
    phase: string;
    eventName: string;
    status: string;
    latencyMs: number | null;
    createdAt: string;
    metadata: Record<string, unknown>;
  }>;
  findings: Array<{
    id: string;
    status: string;
    signalType: string;
    severity: string;
    confidence: number;
    title: string;
    summary: string;
    entityType: string;
    entityId: string | null;
    evidence: string[];
    hitlRequestId: string | null;
    hitlDecisionStatus: string | null;
  }>;
}> {
  await ensureFleetGraphTables();

  const runResult = await pool.query<{
    id: string;
    trigger: string;
    branch: string;
    trace_url: string;
    latency_ms: number;
    token_estimate: number;
    cost_estimate_usd: string;
    created_at: string;
    run_input: Record<string, unknown> | string;
    run_output: Record<string, unknown> | string;
  }>(
    `SELECT
       id,
       trigger,
       branch,
       trace_url,
       latency_ms,
       token_estimate,
       cost_estimate_usd::text,
       created_at::text,
       run_input,
       run_output
     FROM fleetgraph_runs
     WHERE workspace_id = $1
       AND trace_id = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [workspaceId, traceId]
  );

  const run = runResult.rows[0];
  if (!run) {
    throw new Error('Trace not found');
  }

  const timelineResult = await pool.query<{
    phase: string;
    event_name: string;
    event_status: string;
    latency_ms: number | null;
    metadata: Record<string, unknown> | string;
    created_at: string;
  }>(
    `SELECT
       phase,
       event_name,
       event_status,
       latency_ms,
       metadata,
       created_at::text
     FROM fleetgraph_trace_events
     WHERE workspace_id = $1
       AND trace_id = $2
     ORDER BY created_at ASC`,
    [workspaceId, traceId]
  );

  const findingsResult = await pool.query<{
    id: string;
    status: string;
    signal_type: string;
    severity: string;
    confidence: string;
    title: string;
    summary: string;
    entity_type: string;
    entity_id: string | null;
    evidence: string[] | string;
    hitl_request_id: string | null;
    hitl_decision_status: string | null;
  }>(
    `SELECT
       f.id,
       f.status,
       f.signal_type,
       f.severity,
       f.confidence::text,
       f.title,
       f.summary,
       f.entity_type,
       f.entity_id::text,
       f.evidence,
       h.id::text AS hitl_request_id,
       h.decision_status AS hitl_decision_status
     FROM fleetgraph_findings f
     LEFT JOIN fleetgraph_hitl_requests h
       ON h.finding_id = f.id
     WHERE f.workspace_id = $1
       AND f.run_id = $2
     ORDER BY f.updated_at DESC`,
    [workspaceId, run.id]
  );

  const findings = findingsResult.rows.map((row) => ({
    id: row.id,
    status: row.status,
    signalType: row.signal_type,
    severity: row.severity,
    confidence: Number(row.confidence),
    title: row.title,
    summary: row.summary,
    entityType: row.entity_type,
    entityId: row.entity_id,
    evidence:
      Array.isArray(row.evidence)
        ? row.evidence
        : typeof row.evidence === 'string'
          ? (JSON.parse(row.evidence) as string[])
          : [],
    hitlRequestId: row.hitl_request_id,
    hitlDecisionStatus: row.hitl_decision_status,
  }));

  const signalTypes = [...new Set(findings.map((finding) => finding.signalType))];
  const hitlPendingCount = findings.filter((finding) => finding.hitlDecisionStatus === 'pending').length;
  const runOutput =
    typeof run.run_output === 'string'
      ? (JSON.parse(run.run_output) as Record<string, unknown>)
      : run.run_output;

  return {
    traceId,
    traceUrl: run.trace_url,
    run: {
      runId: run.id,
      trigger: run.trigger,
      branch: run.branch,
      latencyMs: run.latency_ms,
      tokenEstimate: run.token_estimate,
      costEstimateUsd: Number(run.cost_estimate_usd),
      createdAt: toIsoString(run.created_at),
      runInput:
        typeof run.run_input === 'string'
          ? (JSON.parse(run.run_input) as Record<string, unknown>)
          : run.run_input,
      runOutput,
    },
    observability: {
      latencyBudgetMs: PRD_LATENCY_BUDGET_MS,
      withinLatencyBudget: run.latency_ms < PRD_LATENCY_BUDGET_MS,
      signalCount: findings.length,
      signalTypes,
      branchDivergenceMarker: `${run.trigger}:${run.branch}:${signalTypes.join(',') || 'no_signals'}`,
      hitlPendingCount,
    },
    timeline: timelineResult.rows.map((row) => ({
      phase: row.phase,
      eventName: row.event_name,
      status: row.event_status,
      latencyMs: row.latency_ms,
      createdAt: toIsoString(row.created_at),
      metadata:
        typeof row.metadata === 'string'
          ? (JSON.parse(row.metadata) as Record<string, unknown>)
          : row.metadata,
    })),
    findings,
  };
}
