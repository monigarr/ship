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
  externalTraceUrl: string | null;
}

const DEFAULT_INTERNAL_TRACE_BASE_PATH = '/fleetgraph/traces';
const DEFAULT_LANGSMITH_API_BASE_URL = 'https://api.smith.langchain.com';
const DEFAULT_LANGSMITH_PUBLIC_BASE_URL = 'https://smith.langchain.com';
const DEFAULT_LANGSMITH_TRACES_URL =
  'https://smith.langchain.com/o/53ea29ad-725a-449d-8454-a5e5b940ea6c/projects/p/94ee9aa8-6f2b-42b6-80d5-d5c18af5729d?runview=traces';

function resolveInternalTraceBasePath(): string {
  const configured = process.env.FLEETGRAPH_TRACE_BASE_PATH?.trim();
  if (!configured) {
    return DEFAULT_INTERNAL_TRACE_BASE_PATH;
  }
  const prefixed = configured.startsWith('/') ? configured : `/${configured}`;
  const normalized = prefixed.replace(/\/+$/, '');
  return normalized.length > 0 ? normalized : DEFAULT_INTERNAL_TRACE_BASE_PATH;
}

export function buildFleetGraphTraceUrl(traceId: string): string {
  return `${resolveInternalTraceBasePath()}/${traceId}`;
}

export function canonicalizeFleetGraphTraceUrl(traceId: string, traceUrl?: string | null): string {
  const normalizedTraceId = traceId.trim();
  if (normalizedTraceId) {
    return buildFleetGraphTraceUrl(normalizedTraceId);
  }

  const legacyPrefix = 'internal://fleetgraph/';
  if (traceUrl?.startsWith(legacyPrefix)) {
    return buildFleetGraphTraceUrl(traceUrl.slice(legacyPrefix.length));
  }

  if (traceUrl?.startsWith('/')) {
    return traceUrl;
  }

  return resolveInternalTraceBasePath();
}

function logTraceEvent(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ event: 'fleetgraph.trace', ...payload }));
}

function getLangSmithProjectTracesUrl(): string {
  const configured = process.env.LANGSMITH_PROJECT_TRACES_URL?.trim();
  if (configured) {
    return configured;
  }
  return DEFAULT_LANGSMITH_TRACES_URL;
}

function buildLangSmithRunUrl(projectTracesUrl: string, traceId: string): string {
  try {
    const parsed = new URL(projectTracesUrl);
    parsed.search = '';
    parsed.hash = '';
    parsed.pathname = `${parsed.pathname.replace(/\/+$/, '')}/r/${encodeURIComponent(traceId)}`;
    return parsed.toString();
  } catch {
    return projectTracesUrl;
  }
}

function resolveLangSmithRunUrl(traceId: string): string {
  const template = process.env.LANGSMITH_RUN_URL_TEMPLATE?.trim();
  if (template) {
    return template.replaceAll('{runId}', encodeURIComponent(traceId));
  }
  return buildLangSmithRunUrl(getLangSmithProjectTracesUrl(), traceId);
}

function getLangSmithApiBaseUrl(): string {
  const configured = process.env.LANGSMITH_ENDPOINT?.trim();
  if (!configured) {
    return DEFAULT_LANGSMITH_API_BASE_URL;
  }
  return configured.replace(/\/+$/, '');
}

function getLangSmithPublicBaseUrl(): string {
  const configured = process.env.LANGSMITH_PUBLIC_BASE_URL?.trim();
  if (!configured) {
    return DEFAULT_LANGSMITH_PUBLIC_BASE_URL;
  }
  return configured.replace(/\/+$/, '');
}

function isLangSmithEnabled(): boolean {
  return Boolean(process.env.LANGSMITH_API_KEY?.trim() && process.env.LANGSMITH_PROJECT?.trim());
}

async function emitLangSmithRun(input: FleetGraphTraceFinishInput, traceUrl: string): Promise<void> {
  const apiKey = process.env.LANGSMITH_API_KEY?.trim();
  const project = process.env.LANGSMITH_PROJECT?.trim();
  if (!apiKey || !project) {
    return;
  }

  const runStartedAt = new Date(Date.now() - Math.max(0, input.latencyMs)).toISOString();
  const runEndedAt = new Date().toISOString();
  const runName = `FleetGraph ${input.trigger} ${input.branch}`;
  const publicBaseUrl = getLangSmithPublicBaseUrl();

  const response = await fetch(`${getLangSmithApiBaseUrl()}/runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      id: input.traceId,
      session_name: project,
      name: runName,
      run_type: 'chain',
      start_time: runStartedAt,
      end_time: runEndedAt,
      inputs: {
        trigger: input.trigger,
        workspace_id: input.workspaceId,
        user_id: input.userId,
      },
      outputs: {
        branch: input.branch,
        summary: input.summary,
        signal_count: input.signalCount,
        signal_types: input.signalTypes,
        token_estimate: input.tokenEstimate,
        cost_estimate_usd: input.costEstimateUsd,
      },
      extra: {
        metadata: {
          fleetgraph_trace_id: input.traceId,
          internal_trace_url: traceUrl,
          langsmith_trace_url: `${publicBaseUrl}/public/${input.traceId}`,
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`langsmith_emit_failed:${response.status}:${body}`);
  }
}

/**
 * Starts an internal FleetGraph trace and returns shareable in-app trace URL.
 */
export async function startFleetGraphTrace(input: FleetGraphTraceStartInput): Promise<FleetGraphTraceOutput> {
  const traceId = randomUUID();
  const traceUrl = buildFleetGraphTraceUrl(traceId);

  logTraceEvent({
    trace_id: traceId,
    trace_url: traceUrl,
    phase: 'start',
    trigger: input.trigger,
    workspace_id: input.workspaceId,
    user_id: input.userId,
  });

  return { traceId, traceUrl, externalTraceUrl: null };
}

/**
 * Completes an internal FleetGraph trace with branch outputs.
 */
export async function finishFleetGraphTrace(input: FleetGraphTraceFinishInput): Promise<FleetGraphTraceOutput> {
  const traceUrl = buildFleetGraphTraceUrl(input.traceId);
  let externalTraceUrl: string | null = null;

  if (isLangSmithEnabled()) {
    externalTraceUrl = resolveLangSmithRunUrl(input.traceId);
    try {
      await emitLangSmithRun(input, traceUrl);
      logTraceEvent({
        trace_id: input.traceId,
        external_trace_url: externalTraceUrl,
        provider: 'langsmith',
        phase: 'external_emit',
        status: 'ok',
      });
    } catch (error) {
      externalTraceUrl = null;
      logTraceEvent({
        trace_id: input.traceId,
        provider: 'langsmith',
        phase: 'external_emit',
        status: 'error',
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

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
    external_trace_url: externalTraceUrl,
  });

  return { traceId: input.traceId, traceUrl, externalTraceUrl };
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
  langSmithEnabled: boolean;
  langSmithProjectTracesUrl: string | null;
} {
  return {
    traceUrlMode: 'internal',
    internalTraceBasePath: resolveInternalTraceBasePath(),
    langSmithEnabled: isLangSmithEnabled(),
    langSmithProjectTracesUrl: isLangSmithEnabled() ? getLangSmithProjectTracesUrl() : null,
  };
}
