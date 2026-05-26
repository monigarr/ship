import { randomUUID } from 'crypto';
import { Client } from 'langsmith';
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

const DEFAULT_LANGSMITH_RUN_BASE_URL = 'https://smith.langchain.com/public/run';

function resolveLangSmithRunBaseUrl(): string | null {
  const configured = process.env.LANGSMITH_RUN_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  if (process.env.LANGSMITH_API_KEY?.trim()) {
    return DEFAULT_LANGSMITH_RUN_BASE_URL;
  }

  return null;
}

function buildTraceUrl(traceId: string): string {
  const baseUrl = resolveLangSmithRunBaseUrl();
  if (baseUrl) {
    return `${baseUrl}/${traceId}`;
  }
  return `internal://fleetgraph/${traceId}`;
}

function getLangSmithClient(): Client | null {
  const apiKey = process.env.LANGSMITH_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return new Client({ apiKey });
}

function logTraceEvent(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ event: 'fleetgraph.trace', ...payload }));
}

/**
 * Starts a FleetGraph trace. When LANGSMITH_API_KEY is set, creates a LangSmith run.
 */
export async function startFleetGraphTrace(input: FleetGraphTraceStartInput): Promise<FleetGraphTraceOutput> {
  const traceId = randomUUID();
  const traceUrl = buildTraceUrl(traceId);
  const projectName = process.env.LANGSMITH_PROJECT?.trim() || 'fleetgraph-ship';

  const client = getLangSmithClient();
  if (client) {
    try {
      await client.createRun({
        id: traceId,
        name: 'FleetGraph',
        run_type: 'chain',
        project_name: projectName,
        inputs: {
          trigger: input.trigger,
          workspaceId: input.workspaceId,
          userId: input.userId,
          documentId: input.context?.documentId ?? null,
          documentType: input.context?.documentType ?? null,
          prompt: input.context?.prompt ?? null,
        },
        extra: {
          metadata: {
            workspace_id: input.workspaceId,
            user_id: input.userId,
            tags: ['fleetgraph', input.trigger],
          },
        },
      });
    } catch (error) {
      console.error('FleetGraph LangSmith createRun failed:', error);
    }
  }

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
 * Completes a FleetGraph trace with branch outputs. Updates LangSmith when configured.
 */
export async function finishFleetGraphTrace(input: FleetGraphTraceFinishInput): Promise<FleetGraphTraceOutput> {
  const traceUrl = buildTraceUrl(input.traceId);
  const client = getLangSmithClient();

  if (client) {
    try {
      await client.updateRun(input.traceId, {
        outputs: {
          branch: input.branch,
          signalTypes: input.signalTypes,
          signalCount: input.signalCount,
          summary: input.summary,
          latencyMs: input.latencyMs,
          tokenEstimate: input.tokenEstimate,
          costEstimateUsd: input.costEstimateUsd,
        },
        end_time: Date.now(),
        tags: ['fleetgraph', input.trigger, input.branch, ...input.signalTypes],
        extra: {
          metadata: {
            branch: input.branch,
            signal_types: input.signalTypes.join(','),
          },
        },
      });
    } catch (error) {
      console.error('FleetGraph LangSmith updateRun failed:', error);
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

/** Safe runtime diagnostics for LangSmith wiring (no secrets returned). */
export function getFleetGraphTraceConfig(): {
  traceUrlMode: 'internal' | 'langsmith';
  langsmithApiKeyConfigured: boolean;
  langsmithProject: string;
  langsmithRunBaseUrl: string | null;
} {
  const langsmithApiKeyConfigured = Boolean(process.env.LANGSMITH_API_KEY?.trim());
  const langsmithRunBaseUrl = resolveLangSmithRunBaseUrl();

  return {
    traceUrlMode: langsmithRunBaseUrl ? 'langsmith' : 'internal',
    langsmithApiKeyConfigured,
    langsmithProject: process.env.LANGSMITH_PROJECT?.trim() || 'fleetgraph-ship',
    langsmithRunBaseUrl,
  };
}
