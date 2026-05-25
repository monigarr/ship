import { randomUUID } from 'crypto';
import type { FleetGraphBranch, FleetGraphTrigger } from './types.js';

export interface FleetGraphTraceInput {
  trigger: FleetGraphTrigger;
  branch: FleetGraphBranch;
  workspaceId: string;
  userId: string;
  latencyMs: number;
  tokenEstimate: number;
  costEstimateUsd: number;
}

export interface FleetGraphTraceOutput {
  traceId: string;
  traceUrl: string;
}

/**
 * Builds a trace id/url payload that can be replaced with LangSmith links.
 * If LANGSMITH_RUN_BASE_URL is configured, links are externally shareable.
 */
export function createFleetGraphTrace(input: FleetGraphTraceInput): FleetGraphTraceOutput {
  const traceId = randomUUID();
  const configuredBaseUrl = process.env.LANGSMITH_RUN_BASE_URL?.trim();

  const traceUrl = configuredBaseUrl
    ? `${configuredBaseUrl.replace(/\/$/, '')}/${traceId}`
    : `internal://fleetgraph/${traceId}`;

  // Structured logging keeps branch-level observability even without LangSmith.
  console.log(
    JSON.stringify({
      event: 'fleetgraph.trace',
      trace_id: traceId,
      trace_url: traceUrl,
      trigger: input.trigger,
      branch: input.branch,
      workspace_id: input.workspaceId,
      user_id: input.userId,
      latency_ms: input.latencyMs,
      token_estimate: input.tokenEstimate,
      cost_estimate_usd: input.costEstimateUsd,
    })
  );

  return { traceId, traceUrl };
}
