/**
 * @version 0.2.0
 * @date 2026-05-25
 * @author Monica Peters <monica.peters@gfachallenger.gauntletai.com>
 *
 * Purpose: Hybrid proactive trigger pipeline for FleetGraph — scheduled poll tiers plus
 * webhook-driven scans against real Ship workspace data.
 *
 * Usage: Import `startFleetGraphProactiveScheduler()` from `api/src/index.ts` on server boot.
 * Enable with `FLEETGRAPH_PROACTIVE_ENABLED=1`. Webhook path: `runFleetGraphProactiveWebhook`.
 *
 * Example:
 *   startFleetGraphProactiveScheduler();
 *   await runFleetGraphProactiveWebhook({ userId, workspaceId, documentId, documentType });
 *
 * Dependencies: `runtime.executeFleetGraphRun`, Postgres `fleetgraph_scan_state` tables.
 *
 * Security/PHI: Runs under workspace admin service identity; no PHI beyond project records.
 * HIPAA: N/A — no PHI.
 * FHIR: N/A — not interoperability.
 * Accessibility: N/A — non-UI.
 * Performance: Tiered intervals; skips unchanged workspaces; debounces webhook bursts.
 * Stability: Per-workspace error isolation; in-flight dedupe prevents overlapping scans.
 * Legal/compliance: N/A.
 */

import { pool } from '../../db/client.js';
import { executeFleetGraphRun } from './runtime.js';
import type { FleetGraphContext, FleetGraphRunResult } from './types.js';

export type ProactiveScanKind = 'lightweight' | 'planning_window' | 'health' | 'compliance';

export type ProactiveWebhookEventType =
  | 'issue_updated'
  | 'blocker_created'
  | 'plan_submitted'
  | 'retro_submitted'
  | 'evidence_attached'
  | 'approval_changed'
  | 'compliance_changed'
  | 'sprint_boundary';

export interface ProactiveWebhookPayload {
  eventType?: ProactiveWebhookEventType;
  documentId?: string;
  documentType?: string;
  eventId?: string;
}

interface WorkspaceScanTarget {
  workspace_id: string;
  user_id: string;
}

interface ScanTierConfig {
  kind: ProactiveScanKind;
  intervalMs: number;
  prompt: string;
  skipUnchanged: boolean;
}

const DEFAULT_LIGHTWEIGHT_MS = 3 * 60 * 1000;
const DEFAULT_PLANNING_MS = 5 * 60 * 1000;
const DEFAULT_HEALTH_MS = 6 * 60 * 60 * 1000;
const DEFAULT_COMPLIANCE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WEBHOOK_DEBOUNCE_MS = 30 * 1000;
const DEFAULT_PLANNING_WINDOW_DOW = '1,2,3';

const HIGH_SIGNAL_DOCUMENT_TYPES = new Set([
  'issue',
  'weekly_plan',
  'weekly_retro',
  'weekly_review',
  'project',
  'standup',
  'sprint',
]);

const inFlightScans = new Set<string>();

function envMs(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function envFlag(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }
  return raw === '1' || raw.toLowerCase() === 'true';
}

function scanTierConfigs(): ScanTierConfig[] {
  return [
    {
      kind: 'lightweight',
      intervalMs: envMs('FLEETGRAPH_POLL_INTERVAL_MS', DEFAULT_LIGHTWEIGHT_MS),
      prompt: 'scheduled proactive scan: lightweight stale-work and blocker check',
      skipUnchanged: true,
    },
    {
      kind: 'planning_window',
      intervalMs: envMs('FLEETGRAPH_PLANNING_POLL_INTERVAL_MS', DEFAULT_PLANNING_MS),
      prompt: 'scheduled proactive scan: planning and retro review window',
      skipUnchanged: true,
    },
    {
      kind: 'health',
      intervalMs: envMs('FLEETGRAPH_HEALTH_POLL_INTERVAL_MS', DEFAULT_HEALTH_MS),
      prompt: 'scheduled proactive scan: full project health',
      skipUnchanged: false,
    },
    {
      kind: 'compliance',
      intervalMs: envMs('FLEETGRAPH_COMPLIANCE_POLL_INTERVAL_MS', DEFAULT_COMPLIANCE_MS),
      prompt: 'scheduled proactive scan: compliance and evidence completeness',
      skipUnchanged: false,
    },
  ];
}

function planningWindowDays(): Set<number> {
  const raw = process.env.FLEETGRAPH_PLANNING_WINDOW_DOW ?? DEFAULT_PLANNING_WINDOW_DOW;
  const days = raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  return new Set(days.length > 0 ? days : [1, 2, 3]);
}

export async function ensureProactiveScanTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fleetgraph_scan_state (
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      scan_kind TEXT NOT NULL,
      last_scan_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      content_fingerprint TEXT,
      PRIMARY KEY (workspace_id, scan_kind)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fleetgraph_webhook_dedupe (
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      document_id UUID NOT NULL,
      last_triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (workspace_id, document_id)
    );
  `);
}

async function loadWorkspaceScanTargets(): Promise<WorkspaceScanTarget[]> {
  const result = await pool.query<WorkspaceScanTarget>(
    `SELECT DISTINCT ON (wm.workspace_id)
       wm.workspace_id,
       wm.user_id
     FROM workspace_memberships wm
     JOIN workspaces w ON w.id = wm.workspace_id
     WHERE w.archived_at IS NULL
     ORDER BY wm.workspace_id, CASE WHEN wm.role = 'admin' THEN 0 ELSE 1 END, wm.created_at ASC`
  );

  return result.rows;
}

async function getWorkspaceContentFingerprint(workspaceId: string): Promise<string | null> {
  const result = await pool.query<{ fingerprint: string | null }>(
    `SELECT COALESCE(
       MAX(updated_at)::text,
       MAX(created_at)::text
     ) AS fingerprint
     FROM documents
     WHERE workspace_id = $1
       AND deleted_at IS NULL
       AND archived_at IS NULL`,
    [workspaceId]
  );

  return result.rows[0]?.fingerprint ?? null;
}

async function getLastScanAt(workspaceId: string, scanKind: ProactiveScanKind): Promise<Date | null> {
  const result = await pool.query<{ last_scan_at: string | null }>(
    `SELECT last_scan_at
     FROM fleetgraph_scan_state
     WHERE workspace_id = $1 AND scan_kind = $2`,
    [workspaceId, scanKind]
  );

  const value = result.rows[0]?.last_scan_at;
  return value ? new Date(value) : null;
}

async function getStoredFingerprint(
  workspaceId: string,
  scanKind: ProactiveScanKind
): Promise<string | null> {
  const result = await pool.query<{ content_fingerprint: string | null }>(
    `SELECT content_fingerprint
     FROM fleetgraph_scan_state
     WHERE workspace_id = $1 AND scan_kind = $2`,
    [workspaceId, scanKind]
  );

  return result.rows[0]?.content_fingerprint ?? null;
}

async function recordScanCompletion(
  workspaceId: string,
  scanKind: ProactiveScanKind,
  fingerprint: string | null
): Promise<void> {
  await pool.query(
    `INSERT INTO fleetgraph_scan_state (workspace_id, scan_kind, last_scan_at, content_fingerprint)
     VALUES ($1, $2, NOW(), $3)
     ON CONFLICT (workspace_id, scan_kind) DO UPDATE
       SET last_scan_at = NOW(),
           content_fingerprint = EXCLUDED.content_fingerprint`,
    [workspaceId, scanKind, fingerprint]
  );
}

export function isPlanningReviewWindow(now: Date = new Date()): boolean {
  return planningWindowDays().has(now.getUTCDay());
}

async function workspaceHasActivePlanningSignals(workspaceId: string): Promise<boolean> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM documents
     WHERE workspace_id = $1
       AND deleted_at IS NULL
       AND archived_at IS NULL
       AND document_type IN ('weekly_plan', 'weekly_retro', 'weekly_review')
       AND updated_at >= NOW() - INTERVAL '14 days'`,
    [workspaceId]
  );

  return Number(result.rows[0]?.count ?? 0) > 0;
}

export async function shouldRunScanTier(
  workspaceId: string,
  tier: ScanTierConfig,
  now: Date = new Date()
): Promise<boolean> {
  if (tier.kind === 'planning_window') {
    const inWindow = isPlanningReviewWindow(now);
    const hasPlanningActivity = await workspaceHasActivePlanningSignals(workspaceId);
    if (!inWindow && !hasPlanningActivity) {
      return false;
    }
  }

  const lastScanAt = await getLastScanAt(workspaceId, tier.kind);
  if (!lastScanAt) {
    return true;
  }

  return now.getTime() - lastScanAt.getTime() >= tier.intervalMs;
}

export async function shouldSkipUnchangedScan(
  workspaceId: string,
  tier: ScanTierConfig
): Promise<boolean> {
  if (!tier.skipUnchanged || !envFlag('FLEETGRAPH_SKIP_UNCHANGED_SCANS', true)) {
    return false;
  }

  const fingerprint = await getWorkspaceContentFingerprint(workspaceId);
  if (!fingerprint) {
    return false;
  }

  const stored = await getStoredFingerprint(workspaceId, tier.kind);
  return stored !== null && stored === fingerprint;
}

function inFlightKey(workspaceId: string, scanKind: ProactiveScanKind | 'webhook'): string {
  return `${workspaceId}:${scanKind}`;
}

async function runWorkspaceScan(
  target: WorkspaceScanTarget,
  tier: ScanTierConfig
): Promise<'ran' | 'skipped' | 'deduped'> {
  const key = inFlightKey(target.workspace_id, tier.kind);
  if (inFlightScans.has(key)) {
    return 'deduped';
  }

  const due = await shouldRunScanTier(target.workspace_id, tier);
  if (!due) {
    return 'skipped';
  }

  if (await shouldSkipUnchangedScan(target.workspace_id, tier)) {
    await recordScanCompletion(
      target.workspace_id,
      tier.kind,
      await getWorkspaceContentFingerprint(target.workspace_id)
    );
    return 'skipped';
  }

  inFlightScans.add(key);
  try {
    await executeFleetGraphRun('proactive_poll', {
      userId: target.user_id,
      workspaceId: target.workspace_id,
      prompt: tier.prompt,
    });
    await recordScanCompletion(
      target.workspace_id,
      tier.kind,
      await getWorkspaceContentFingerprint(target.workspace_id)
    );
    return 'ran';
  } finally {
    inFlightScans.delete(key);
  }
}

export async function runFleetGraphProactivePoll(
  scanKind: ProactiveScanKind = 'lightweight'
): Promise<{ ran: number; skipped: number; deduped: number; failed: number }> {
  await ensureProactiveScanTables();

  const tier = scanTierConfigs().find((config) => config.kind === scanKind);
  if (!tier) {
    throw new Error(`Unknown proactive scan kind: ${scanKind}`);
  }

  const targets = await loadWorkspaceScanTargets();
  const stats = { ran: 0, skipped: 0, deduped: 0, failed: 0 };

  for (const target of targets) {
    try {
      const outcome = await runWorkspaceScan(target, tier);
      stats[outcome] += 1;
    } catch (error) {
      stats.failed += 1;
      console.error(
        'FleetGraph proactive scan failed for workspace',
        target.workspace_id,
        'kind',
        scanKind,
        error
      );
    }
  }

  return stats;
}

async function isWebhookDebounced(workspaceId: string, documentId: string): Promise<boolean> {
  const debounceMs = envMs('FLEETGRAPH_WEBHOOK_DEBOUNCE_MS', DEFAULT_WEBHOOK_DEBOUNCE_MS);
  const result = await pool.query<{ last_triggered_at: string }>(
    `SELECT last_triggered_at
     FROM fleetgraph_webhook_dedupe
     WHERE workspace_id = $1 AND document_id = $2`,
    [workspaceId, documentId]
  );

  const lastTriggered = result.rows[0]?.last_triggered_at;
  if (!lastTriggered) {
    return false;
  }

  return Date.now() - new Date(lastTriggered).getTime() < debounceMs;
}

async function recordWebhookTrigger(workspaceId: string, documentId: string): Promise<void> {
  await pool.query(
    `INSERT INTO fleetgraph_webhook_dedupe (workspace_id, document_id, last_triggered_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (workspace_id, document_id) DO UPDATE
       SET last_triggered_at = NOW()`,
    [workspaceId, documentId]
  );
}

function buildWebhookPrompt(payload?: ProactiveWebhookPayload): string {
  const eventType = payload?.eventType ?? 'ship_event';
  return `webhook-triggered proactive scan: ${eventType}`;
}

export function isHighSignalWebhookDocument(documentType?: string): boolean {
  if (!documentType) {
    return false;
  }
  return HIGH_SIGNAL_DOCUMENT_TYPES.has(documentType);
}

export async function runFleetGraphProactiveWebhook(
  context: FleetGraphContext,
  payload?: ProactiveWebhookPayload
): Promise<FleetGraphRunResult | { skipped: true; reason: string }> {
  await ensureProactiveScanTables();

  const documentId = payload?.documentId ?? context.documentId;
  const documentType = payload?.documentType ?? context.documentType;

  if (documentId) {
    const debounced = await isWebhookDebounced(context.workspaceId, documentId);
    if (debounced) {
      return { skipped: true, reason: 'webhook_debounced' };
    }
  }

  const key = inFlightKey(context.workspaceId, 'webhook');
  if (inFlightScans.has(key)) {
    return { skipped: true, reason: 'webhook_in_flight' };
  }

  inFlightScans.add(key);
  try {
    const result = await executeFleetGraphRun('proactive_webhook', {
      ...context,
      documentId,
      documentType,
      prompt: buildWebhookPrompt(payload),
    });

    if (documentId) {
      await recordWebhookTrigger(context.workspaceId, documentId);
    }

    await recordScanCompletion(
      context.workspaceId,
      'lightweight',
      await getWorkspaceContentFingerprint(context.workspaceId)
    );

    return result;
  } finally {
    inFlightScans.delete(key);
  }
}

/**
 * Fire-and-forget helper for Ship document/event mutations.
 * Swallows errors so primary request paths stay resilient.
 */
export function scheduleProactiveWebhookFromShipEvent(
  context: FleetGraphContext,
  payload?: ProactiveWebhookPayload
): void {
  if (process.env.FLEETGRAPH_PROACTIVE_ENABLED !== '1') {
    return;
  }

  if (payload?.documentType && !isHighSignalWebhookDocument(payload.documentType)) {
    return;
  }

  runFleetGraphProactiveWebhook(context, payload).catch((error) => {
    console.error('FleetGraph scheduled webhook scan failed:', error);
  });
}

export function startFleetGraphProactiveScheduler(): () => void {
  const enabled = process.env.FLEETGRAPH_PROACTIVE_ENABLED === '1';
  if (!enabled) {
    return () => {};
  }

  const tiers = scanTierConfigs();
  const intervalHandles: ReturnType<typeof setInterval>[] = [];

  const runTier = (kind: ProactiveScanKind) => {
    runFleetGraphProactivePoll(kind).catch((error) => {
      console.error(`FleetGraph scheduled proactive scan failed (${kind}):`, error);
    });
  };

  ensureProactiveScanTables()
    .then(() => {
      runTier('lightweight');
      for (const tier of tiers) {
        if (tier.kind === 'lightweight') {
          continue;
        }
        runTier(tier.kind);
      }
    })
    .catch((error) => {
      console.error('FleetGraph proactive infrastructure init failed:', error);
    });

  for (const tier of tiers) {
    intervalHandles.push(
      setInterval(() => {
        runTier(tier.kind);
      }, tier.intervalMs)
    );
  }

  return () => {
    for (const handle of intervalHandles) {
      clearInterval(handle);
    }
  };
}
