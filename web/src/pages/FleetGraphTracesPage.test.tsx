import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FleetGraphTracesPage } from './FleetGraphTracesPage';
import { apiGet } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
}));

function renderPage(initialEntry = '/fleetgraph/traces') {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/fleetgraph/traces" element={<FleetGraphTracesPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('FleetGraphTracesPage', () => {
  const mockedApiGet = vi.mocked(apiGet);

  beforeEach(() => {
    mockedApiGet.mockReset();
    mockedApiGet.mockResolvedValue({
      ok: true,
      json: async () => ({
        runs: [
          {
            runId: 'run-1',
            traceId: 'trace-1',
            trigger: 'on_demand',
            branch: 'planning_risk',
            traceUrl: 'https://external-observability.example/trace/stale-external-trace',
            latencyMs: 1200,
            createdAt: '2026-05-26T21:00:00.000Z',
            status: 'pending_approval',
            severity: 'high',
            signalCount: 3,
            topSignal: {
              title: 'Weak plan quality: Test Weekly Plan',
              summary: 'Plan content is likely too short to define measurable outcomes.',
              signalType: 'planning_risk',
              status: 'pending_approval',
              severity: 'high',
              confidence: 0.9,
            },
            affectedRecord: {
              entityType: 'weekly_plan',
              entityId: 'plan-1',
              title: 'Test Weekly Plan',
              href: '/documents/plan-1',
            },
            nextAction: 'Review the plan and request clearer owners, outcomes, or approval',
            audience: [
              {
                role: 'engineering_manager',
                reason: 'Weekly plan quality or approval needs review.',
              },
            ],
          },
        ],
        total: 1,
        limit: 25,
        offset: 0,
      }),
    } as unknown as Response);
  });

  it('renders enterprise trace table rows', async () => {
    renderPage();

    expect(await screen.findByText('FleetGraph Traces')).toBeInTheDocument();
    expect(await screen.findByText('Pending Approval')).toBeInTheDocument();
    expect((await screen.findAllByText('High')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Weak plan quality: Test Weekly Plan')).toBeInTheDocument();
    expect(await screen.findByText('Test Weekly Plan')).toBeInTheDocument();
    expect(await screen.findByText('Review the plan and request clearer owners, outcomes, or approval')).toBeInTheDocument();
    expect(await screen.findByText('Engineering Manager')).toBeInTheDocument();
    expect(await screen.findByText('Trace trace-1')).toBeInTheDocument();
    expect(await screen.findByText('planning_risk (on_demand)')).toBeInTheDocument();
  });

  it('links trace rows to internal FleetGraph trace details even when stored URL is external', async () => {
    renderPage();

    const traceLink = await screen.findByRole('link', { name: 'Open FleetGraph trace trace-1' });
    expect(traceLink).toHaveAttribute('href', '/fleetgraph/traces/trace-1');
  });

  it('falls back to run id when a legacy trace row only points to the trace index', async () => {
    mockedApiGet.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        runs: [
          {
            runId: 'legacy-run-1',
            traceId: '',
            trigger: 'proactive_poll',
            branch: 'execution_risk',
            traceUrl: '/fleetgraph/traces',
            latencyMs: 800,
            createdAt: '2026-05-26T21:05:00.000Z',
            status: 'attention',
            severity: 'high',
            signalCount: 1,
            topSignal: null,
            affectedRecord: null,
            nextAction: 'No action needed',
            audience: [],
          },
        ],
        total: 1,
        limit: 25,
        offset: 0,
      }),
    } as unknown as Response);

    renderPage();

    const traceLink = await screen.findByRole('link', {
      name: 'Open FleetGraph trace legacy-run-1',
    });
    expect(traceLink).toHaveAttribute('href', '/fleetgraph/traces/legacy-run-1');
    expect(screen.queryByText('Trace index')).not.toBeInTheDocument();
  });

  it('sends column filters for created date, latency, status, severity, signals, and trace', async () => {
    renderPage(
      '/fleetgraph/traces?from=2026-05-01T00%3A00&to=2026-05-27T23%3A59&minLatencyMs=100&maxLatencyMs=300000&status=attention&severity=high&minSignalCount=1&maxSignalCount=5&trace=planning'
    );

    await screen.findByText('FleetGraph Traces');

    await waitFor(() => {
      expect(mockedApiGet).toHaveBeenCalledWith(expect.stringContaining('from=2026-05-01T00%3A00'));
      expect(mockedApiGet).toHaveBeenCalledWith(expect.stringContaining('to=2026-05-27T23%3A59'));
      expect(mockedApiGet).toHaveBeenCalledWith(expect.stringContaining('minLatencyMs=100'));
      expect(mockedApiGet).toHaveBeenCalledWith(expect.stringContaining('maxLatencyMs=300000'));
      expect(mockedApiGet).toHaveBeenCalledWith(expect.stringContaining('status=attention'));
      expect(mockedApiGet).toHaveBeenCalledWith(expect.stringContaining('severity=high'));
      expect(mockedApiGet).toHaveBeenCalledWith(expect.stringContaining('minSignalCount=1'));
      expect(mockedApiGet).toHaveBeenCalledWith(expect.stringContaining('maxSignalCount=5'));
      expect(mockedApiGet).toHaveBeenCalledWith(expect.stringContaining('trace=planning'));
    });
  });

  it('updates sorting query when clicking column header', async () => {
    renderPage();
    await screen.findByText('FleetGraph Traces');

    fireEvent.click(screen.getByRole('button', { name: /latency/i }));

    await waitFor(() => {
      expect(mockedApiGet).toHaveBeenCalledWith(
        expect.stringContaining('/api/fleetgraph/traces?sortBy=latencyMs&sortDir=asc')
      );
    });
  });

  it('updates sorting query when clicking signals and trace column headers', async () => {
    renderPage();
    await screen.findByText('FleetGraph Traces');

    fireEvent.click(screen.getByRole('button', { name: /signals/i }));
    await waitFor(() => {
      expect(mockedApiGet).toHaveBeenCalledWith(
        expect.stringContaining('/api/fleetgraph/traces?sortBy=signalCount&sortDir=asc')
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /trace/i }));
    await waitFor(() => {
      expect(mockedApiGet).toHaveBeenCalledWith(
        expect.stringContaining('/api/fleetgraph/traces?sortBy=trace&sortDir=asc')
      );
    });
  });
});
