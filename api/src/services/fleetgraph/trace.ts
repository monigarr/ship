import { randomUUID } from 'crypto';
import type { FleetGraphBranch, FleetGraphContext, FleetGraphTrigger } from './types.js';

export interface FleetGraphTraceStartInput {
  trigger: FleetGraphTrigger;
  workspaceId: string;
  userId: string;
  context?: Pick<FleetGraphContext, 'documentId' | 'documentType' | 'prompt'>;
}

export interface FleetGraphTraceFinishInput {
  traceId: string;
  trigger: FleetGraphTrigger;
  branch: FleetGraphBranch;
  workspaceId: string;
  userId: string;
  latencyMs: number;
  tokenEstimate: number;
  costEstimateUsd: number;
  signalTypes: FleetGraphBranch[];
  signalCount: number;
  summary: string;
}

export interface FleetGraphTraceOutput {
  traceId: string;
  traceUrl: string;
}

const DEFAULT_INTERNAL_TRACE_BASE_PATH = '/fleetgraph/traces';

function resolveInternalTraceBasePath(): string {
  const configured = process.env.FLEETGRAPH_TRACE_BASE_PATH?.trim();
  if (!configured) {
    return DEFAULT_INTERNAL_TRACE_BASE_PATH;
  }
  const prefixed = configured.startsWith('/') ? configured : `/${configured}`;
  const normalized = prefixed.replace(/\/+$/, '');
  return normalized.length > 0 ? normalized : DEFAULT_INTERNAL_TRACE_BASE_PATH;
}

function buildTraceUrl(traceId: string): string {
  return `${resolveInternalTraceBasePath()}/${traceId}`;
}

function logTraceEvent(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ event: 'fleetgraph.trace', ...payload }));
}

/**
 * Starts an internal FleetGraph trace and returns shareable in-app trace URL.
 */
export async function startFleetGraphTrace(input: FleetGraphTraceStartInput): Promise<FleetGraphTraceOutput> {
  const traceId = randomUUID();
  const traceUrl = buildTraceUrl(traceId);

  logTraceEvent({
    trace_id: traceId,
    trace_url: traceUrl,
    phase: 'start',
    trigger: input.trigger,
    workspace_id: input.workspaceId,
    user_id: input.userId,
  });

  return { traceId, traceUrl };
}

/**
 * Completes an internal FleetGraph trace with branch outputs.
 */
export async function finishFleetGraphTrace(input: FleetGraphTraceFinishInput): Promise<FleetGraphTraceOutput> {
  const traceUrl = buildTraceUrl(input.traceId);

  logTraceEvent({
    trace_id: input.traceId,
    trace_url: traceUrl,
    phase: 'finish',
    trigger: input.trigger,
    branch: input.branch,
    workspace_id: input.workspaceId,
    user_id: input.userId,
    latency_ms: input.latencyMs,
    token_estimate: input.tokenEstimate,
    cost_estimate_usd: input.costEstimateUsd,
    signal_types: input.signalTypes,
    signal_count: input.signalCount,
  });

  return { traceId: input.traceId, traceUrl };
}

/** @deprecated Use startFleetGraphTrace + finishFleetGraphTrace */
export async function createFleetGraphTrace(input: {
  trigger: FleetGraphTrigger;
  branch: FleetGraphBranch;
  workspaceId: string;
  userId: string;
  latencyMs: number;
  tokenEstimate: number;
  costEstimateUsd: number;
  signalTypes?: FleetGraphBranch[];
  signalCount?: number;
  summary?: string;
}): Promise<FleetGraphTraceOutput> {
  const started = await startFleetGraphTrace({
    trigger: input.trigger,
    workspaceId: input.workspaceId,
    userId: input.userId,
  });

  return finishFleetGraphTrace({
    traceId: started.traceId,
    trigger: input.trigger,
    branch: input.branch,
    workspaceId: input.workspaceId,
    userId: input.userId,
    latencyMs: input.latencyMs,
    tokenEstimate: input.tokenEstimate,
    costEstimateUsd: input.costEstimateUsd,
    signalTypes: input.signalTypes ?? (input.branch === 'no_action' ? [] : [input.branch]),
    signalCount: input.signalCount ?? 0,
    summary: input.summary ?? `FleetGraph (${input.trigger}) branch ${input.branch}`,
  });
}

/** Safe runtime diagnostics for internal trace wiring. */
export function getFleetGraphTraceConfig(): {
  traceUrlMode: 'internal';
  internalTraceBasePath: string;
} {
  return {
    traceUrlMode: 'internal',
    internalTraceBasePath: resolveInternalTraceBasePath(),
  };
}
