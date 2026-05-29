import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FleetGraphAssistant } from './FleetGraphAssistant';

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock('@/lib/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPost: (...args: unknown[]) => apiPostMock(...args),
}));

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderAssistant() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <FleetGraphAssistant />
    </QueryClientProvider>
  );
}

describe('FleetGraphAssistant diagnostics', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/api/fleetgraph/metrics') {
        return Promise.resolve(
          jsonResponse({
            runCount: 4,
            avgLatencyMs: 123,
            tokenTotals: {
              all: 4200,
              actualModelUsage: 3600,
              heuristicEstimate: 600,
              current30Days: 3000,
              previous30Days: 1200,
            },
            spend: {
              runtimeTotalUsd: 8.5,
              billedTotalUsd: 8.8,
              deltaUsd: 0.3,
              billedCoverageRuns: 3,
              billedCoveragePct: 75,
            },
            monthlyProjection: {
              basis: 'trailing_30_day_daily_average',
              runtimeUsd: 6.4,
              billedUsd: 6.7,
              deltaUsd: 0.3,
            },
            modelUsage: [
              {
                modelId: 'global.anthropic.claude-opus-4-5-20251101-v1:0',
                runCount: 3,
                tokenTotal: 3600,
                runtimeSpendUsd: 7.5,
                billedSpendUsd: 7.8,
                tokenSource: 'actual_model_usage',
              },
            ],
          })
        );
      }

      if (url === '/api/fleetgraph/traces') {
        return Promise.resolve(jsonResponse({ runs: [] }));
      }

      return Promise.resolve(jsonResponse({}, 404));
    });
  });

  it('renders truth-based token, spend, and model diagnostics', async () => {
    renderAssistant();

    expect(await screen.findByText(/Runs: 4 \| Avg latency: 123ms/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Tokens: 4,200 \(30d: 3,000 \| Prev 30d: 1,200\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Runtime spend: \$8\.500 \| Billed spend: \$8\.800/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Model: global\.anthropic\.claude-opus-4-5-20251101-v1:0 \| Token basis: actual model usage/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Monthly projection \(trailing 30 day daily average\): runtime \$6\.40 \| billed \$6\.70 \| delta \$0\.30/i)
    ).toBeInTheDocument();
  });
});
