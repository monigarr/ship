import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  canonicalizeFleetGraphTraceUrl,
  createFleetGraphTrace,
  finishFleetGraphTrace,
  getFleetGraphTraceConfig,
  startFleetGraphTrace,
} from './trace.js';

describe('FleetGraph trace', () => {
  const originalTraceBasePath = process.env.FLEETGRAPH_TRACE_BASE_PATH;
  const originalLangSmithApiKey = process.env.LANGSMITH_API_KEY;
  const originalLangSmithProject = process.env.LANGSMITH_PROJECT;
  const originalLangSmithEndpoint = process.env.LANGSMITH_ENDPOINT;
  const originalLangSmithProjectTracesUrl = process.env.LANGSMITH_PROJECT_TRACES_URL;

  afterEach(() => {
    if (originalTraceBasePath === undefined) {
      delete process.env.FLEETGRAPH_TRACE_BASE_PATH;
    } else {
      process.env.FLEETGRAPH_TRACE_BASE_PATH = originalTraceBasePath;
    }
    if (originalLangSmithApiKey === undefined) {
      delete process.env.LANGSMITH_API_KEY;
    } else {
      process.env.LANGSMITH_API_KEY = originalLangSmithApiKey;
    }
    if (originalLangSmithProject === undefined) {
      delete process.env.LANGSMITH_PROJECT;
    } else {
      process.env.LANGSMITH_PROJECT = originalLangSmithProject;
    }
    if (originalLangSmithEndpoint === undefined) {
      delete process.env.LANGSMITH_ENDPOINT;
    } else {
      process.env.LANGSMITH_ENDPOINT = originalLangSmithEndpoint;
    }
    if (originalLangSmithProjectTracesUrl === undefined) {
      delete process.env.LANGSMITH_PROJECT_TRACES_URL;
    } else {
      process.env.LANGSMITH_PROJECT_TRACES_URL = originalLangSmithProjectTracesUrl;
    }
    vi.restoreAllMocks();
  });

  it('returns internal trace URL when no base path override is configured', async () => {
    delete process.env.FLEETGRAPH_TRACE_BASE_PATH;
    const started = await startFleetGraphTrace({
      trigger: 'on_demand',
      workspaceId: 'ws-1',
      userId: 'user-1',
    });

    const result = await finishFleetGraphTrace({
      traceId: started.traceId,
      trigger: 'on_demand',
      branch: 'execution_risk',
      workspaceId: 'ws-1',
      userId: 'user-1',
      latencyMs: 42,
      tokenEstimate: 3750,
      costEstimateUsd: 0.006,
      signalTypes: ['execution_risk'],
      signalCount: 1,
      summary: 'test summary',
    });

    expect(result.traceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(result.traceUrl).toBe(`/fleetgraph/traces/${result.traceId}`);
    expect(result.externalTraceUrl).toBeNull();
  });

  it('uses configured internal base path and normalizes slashes', async () => {
    process.env.FLEETGRAPH_TRACE_BASE_PATH = 'fleetgraph/internal-traces/';
    const result = await createFleetGraphTrace({
      trigger: 'proactive_webhook',
      branch: 'compliance_risk',
      workspaceId: 'ws-1',
      userId: 'user-1',
      latencyMs: 10,
      tokenEstimate: 7500,
      costEstimateUsd: 0.012,
      signalTypes: ['compliance_risk'],
      signalCount: 1,
      summary: 'compliance summary',
    });

    expect(result.traceUrl).toBe(`/fleetgraph/internal-traces/${result.traceId}`);
    expect(result.externalTraceUrl).toBeNull();
  });

  it('canonicalizes persisted external trace URLs back to internal trace detail URLs', () => {
    delete process.env.FLEETGRAPH_TRACE_BASE_PATH;

    expect(
      canonicalizeFleetGraphTraceUrl(
        'trace-123',
        'https://external-observability.example/trace/not-the-ship-trace'
      )
    ).toBe('/fleetgraph/traces/trace-123');
  });

  it('exposes safe trace config diagnostics', () => {
    delete process.env.FLEETGRAPH_TRACE_BASE_PATH;

    expect(getFleetGraphTraceConfig()).toMatchObject({
      traceUrlMode: 'internal',
      internalTraceBasePath: '/fleetgraph/traces',
      langSmithEnabled: false,
      langSmithProjectTracesUrl: null,
    });

    process.env.FLEETGRAPH_TRACE_BASE_PATH = '/fleetgraph/custom';
    expect(getFleetGraphTraceConfig()).toMatchObject({
      traceUrlMode: 'internal',
      internalTraceBasePath: '/fleetgraph/custom',
      langSmithEnabled: false,
      langSmithProjectTracesUrl: null,
    });
  });

  it('emits to LangSmith when configured and keeps internal trace as canonical', async () => {
    process.env.LANGSMITH_API_KEY = 'lsv2-test-key';
    process.env.LANGSMITH_PROJECT = 'ship-fleetgraph';
    process.env.LANGSMITH_ENDPOINT = 'https://api.smith.langchain.com';
    process.env.LANGSMITH_PROJECT_TRACES_URL =
      'https://smith.langchain.com/o/demo/projects/p/demo?runview=traces';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const started = await startFleetGraphTrace({
      trigger: 'on_demand',
      workspaceId: 'ws-langsmith',
      userId: 'user-langsmith',
    });
    const finished = await finishFleetGraphTrace({
      traceId: started.traceId,
      trigger: 'on_demand',
      branch: 'planning_risk',
      workspaceId: 'ws-langsmith',
      userId: 'user-langsmith',
      latencyMs: 100,
      tokenEstimate: 3750,
      costEstimateUsd: 0.006,
      signalTypes: ['planning_risk'],
      signalCount: 1,
      summary: 'summary',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.smith.langchain.com/runs',
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(finished.traceUrl).toBe(`/fleetgraph/traces/${finished.traceId}`);
    expect(finished.externalTraceUrl).toBe(
      `https://smith.langchain.com/o/demo/projects/p/demo/r/${finished.traceId}`
    );
  });

  it('fails open when LangSmith emission fails', async () => {
    process.env.LANGSMITH_API_KEY = 'lsv2-test-key';
    process.env.LANGSMITH_PROJECT = 'ship-fleetgraph';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('bad request', { status: 400 })
    );

    const result = await createFleetGraphTrace({
      trigger: 'on_demand',
      branch: 'planning_risk',
      workspaceId: 'ws-abc',
      userId: 'user-xyz',
      latencyMs: 99,
      tokenEstimate: 3750,
      costEstimateUsd: 0.006,
      signalTypes: ['planning_risk'],
      signalCount: 1,
      summary: 'planning summary',
    });

    expect(fetchSpy).toHaveBeenCalled();
    expect(result.traceUrl).toBe(`/fleetgraph/traces/${result.traceId}`);
    expect(result.externalTraceUrl).toBeNull();
  });

  it('logs structured trace event with trigger, branch, and latency', async () => {
    delete process.env.FLEETGRAPH_TRACE_BASE_PATH;
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await createFleetGraphTrace({
      trigger: 'on_demand',
      branch: 'planning_risk',
      workspaceId: 'ws-abc',
      userId: 'user-xyz',
      latencyMs: 99,
      tokenEstimate: 3750,
      costEstimateUsd: 0.006,
      signalTypes: ['planning_risk'],
      signalCount: 1,
      summary: 'planning summary',
    });

    expect(logSpy).toHaveBeenCalled();
    const finishLog = logSpy.mock.calls
      .map((call) => JSON.parse(String(call[0])))
      .find((payload) => payload.phase === 'finish');
    expect(finishLog).toMatchObject({
      event: 'fleetgraph.trace',
      trigger: 'on_demand',
      branch: 'planning_risk',
      latency_ms: 99,
      token_estimate: 3750,
      workspace_id: 'ws-abc',
    });
  });
});
