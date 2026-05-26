import { describe, it, expect, vi, afterEach } from 'vitest';
import { createFleetGraphTrace } from './trace.js';

describe('createFleetGraphTrace', () => {
  const originalLangsmithBase = process.env.LANGSMITH_RUN_BASE_URL;

  afterEach(() => {
    if (originalLangsmithBase === undefined) {
      delete process.env.LANGSMITH_RUN_BASE_URL;
    } else {
      process.env.LANGSMITH_RUN_BASE_URL = originalLangsmithBase;
    }
    vi.restoreAllMocks();
  });

  it('returns internal trace URL when LANGSMITH_RUN_BASE_URL is unset', () => {
    delete process.env.LANGSMITH_RUN_BASE_URL;

    const result = createFleetGraphTrace({
      trigger: 'on_demand',
      branch: 'execution_risk',
      workspaceId: 'ws-1',
      userId: 'user-1',
      latencyMs: 42,
      tokenEstimate: 3750,
      costEstimateUsd: 0.006,
    });

    expect(result.traceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(result.traceUrl).toBe(`internal://fleetgraph/${result.traceId}`);
  });

  it('returns external trace URL when LANGSMITH_RUN_BASE_URL is configured', () => {
    process.env.LANGSMITH_RUN_BASE_URL = 'https://smith.langchain.com/public/run/';

    const result = createFleetGraphTrace({
      trigger: 'proactive_webhook',
      branch: 'compliance_risk',
      workspaceId: 'ws-1',
      userId: 'user-1',
      latencyMs: 10,
      tokenEstimate: 7500,
      costEstimateUsd: 0.012,
    });

    expect(result.traceUrl).toBe(`https://smith.langchain.com/public/run/${result.traceId}`);
  });

  it('strips trailing slash from LANGSMITH_RUN_BASE_URL', () => {
    process.env.LANGSMITH_RUN_BASE_URL = 'https://smith.langchain.com/public/run///';

    const result = createFleetGraphTrace({
      trigger: 'proactive_poll',
      branch: 'no_action',
      workspaceId: 'ws-1',
      userId: 'user-1',
      latencyMs: 5,
      tokenEstimate: 0,
      costEstimateUsd: 0,
    });

    expect(result.traceUrl).toBe(`https://smith.langchain.com/public/run/${result.traceId}`);
  });

  it('logs structured trace event with trigger, branch, and latency', () => {
    delete process.env.LANGSMITH_RUN_BASE_URL;
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    createFleetGraphTrace({
      trigger: 'on_demand',
      branch: 'planning_risk',
      workspaceId: 'ws-abc',
      userId: 'user-xyz',
      latencyMs: 99,
      tokenEstimate: 3750,
      costEstimateUsd: 0.006,
    });

    expect(logSpy).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(payload.event).toBe('fleetgraph.trace');
    expect(payload.trigger).toBe('on_demand');
    expect(payload.branch).toBe('planning_risk');
    expect(payload.latency_ms).toBe(99);
    expect(payload.token_estimate).toBe(3750);
    expect(payload.workspace_id).toBe('ws-abc');
  });
});
