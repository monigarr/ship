import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

const createRunMock = vi.fn().mockResolvedValue(undefined);
const updateRunMock = vi.fn().mockResolvedValue(undefined);

vi.mock('langsmith', () => ({
  Client: class MockLangSmithClient {
    createRun = createRunMock;
    updateRun = updateRunMock;
  },
}));

import { createFleetGraphTrace, finishFleetGraphTrace, getFleetGraphTraceConfig, startFleetGraphTrace } from './trace.js';

describe('FleetGraph trace', () => {
  const originalLangsmithBase = process.env.LANGSMITH_RUN_BASE_URL;
  const originalLangsmithKey = process.env.LANGSMITH_API_KEY;
  const originalLangsmithProject = process.env.LANGSMITH_PROJECT;

  beforeEach(() => {
    createRunMock.mockClear();
    updateRunMock.mockClear();
  });

  afterEach(() => {
    if (originalLangsmithBase === undefined) {
      delete process.env.LANGSMITH_RUN_BASE_URL;
    } else {
      process.env.LANGSMITH_RUN_BASE_URL = originalLangsmithBase;
    }
    if (originalLangsmithKey === undefined) {
      delete process.env.LANGSMITH_API_KEY;
    } else {
      process.env.LANGSMITH_API_KEY = originalLangsmithKey;
    }
    if (originalLangsmithProject === undefined) {
      delete process.env.LANGSMITH_PROJECT;
    } else {
      process.env.LANGSMITH_PROJECT = originalLangsmithProject;
    }
    vi.restoreAllMocks();
  });

  it('returns internal trace URL when LangSmith is not configured', async () => {
    delete process.env.LANGSMITH_RUN_BASE_URL;
    delete process.env.LANGSMITH_API_KEY;

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
    expect(result.traceUrl).toBe(`internal://fleetgraph/${result.traceId}`);
    expect(createRunMock).not.toHaveBeenCalled();
  });

  it('returns external trace URL when LANGSMITH_RUN_BASE_URL is configured', async () => {
    process.env.LANGSMITH_RUN_BASE_URL = 'https://smith.langchain.com/public/run/';
    delete process.env.LANGSMITH_API_KEY;

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

    expect(result.traceUrl).toBe(`https://smith.langchain.com/public/run/${result.traceId}`);
  });

  it('creates and updates LangSmith runs when LANGSMITH_API_KEY is set', async () => {
    process.env.LANGSMITH_API_KEY = 'test-key';
    process.env.LANGSMITH_PROJECT = 'fleetgraph-test';
    process.env.LANGSMITH_RUN_BASE_URL = 'https://smith.langchain.com/public/run/';

    const result = await createFleetGraphTrace({
      trigger: 'proactive_poll',
      branch: 'accountability_risk',
      workspaceId: 'ws-abc',
      userId: 'user-xyz',
      latencyMs: 99,
      tokenEstimate: 3750,
      costEstimateUsd: 0.006,
      signalTypes: ['accountability_risk'],
      signalCount: 1,
      summary: 'accountability summary',
    });

    expect(createRunMock).toHaveBeenCalledOnce();
    expect(updateRunMock).toHaveBeenCalledOnce();
    expect(result.traceUrl).toBe(`https://smith.langchain.com/public/run/${result.traceId}`);
    expect(createRunMock.mock.calls[0]?.[0]).toMatchObject({
      project_name: 'fleetgraph-test',
      inputs: expect.objectContaining({ trigger: 'proactive_poll' }),
    });
  });

  it('defaults to public LangSmith URL when only LANGSMITH_API_KEY is set', async () => {
    delete process.env.LANGSMITH_RUN_BASE_URL;
    process.env.LANGSMITH_API_KEY = 'test-key';

    const result = await createFleetGraphTrace({
      trigger: 'on_demand',
      branch: 'planning_risk',
      workspaceId: 'ws-1',
      userId: 'user-1',
      latencyMs: 12,
      tokenEstimate: 3750,
      costEstimateUsd: 0.006,
      signalTypes: ['planning_risk'],
      signalCount: 1,
      summary: 'planning summary',
    });

    expect(result.traceUrl).toMatch(/^https:\/\/smith\.langchain\.com\/public\/run\//);
  });

  it('exposes safe trace config diagnostics', () => {
    delete process.env.LANGSMITH_RUN_BASE_URL;
    delete process.env.LANGSMITH_API_KEY;

    expect(getFleetGraphTraceConfig()).toMatchObject({
      traceUrlMode: 'internal',
      langsmithApiKeyConfigured: false,
      langsmithRunBaseUrl: null,
    });

    process.env.LANGSMITH_API_KEY = 'test-key';
    expect(getFleetGraphTraceConfig()).toMatchObject({
      traceUrlMode: 'langsmith',
      langsmithApiKeyConfigured: true,
      langsmithRunBaseUrl: 'https://smith.langchain.com/public/run',
    });
  });

  it('logs structured trace event with trigger, branch, and latency', async () => {
    delete process.env.LANGSMITH_RUN_BASE_URL;
    delete process.env.LANGSMITH_API_KEY;
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
