import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

interface FleetGraphTraceDetailResponse {
  traceId: string;
  traceUrl: string;
  run: {
    runId: string;
    trigger: string;
    branch: string;
    latencyMs: number;
    tokenEstimate: number;
    costEstimateUsd: number;
    createdAt: string;
    runInput: Record<string, unknown>;
    runOutput: Record<string, unknown>;
  };
  observability: {
    latencyBudgetMs: number;
    withinLatencyBudget: boolean;
    signalCount: number;
    signalTypes: string[];
    branchDivergenceMarker: string;
    hitlPendingCount: number;
  };
  timeline: Array<{
    phase: string;
    eventName: string;
    status: string;
    latencyMs: number | null;
    createdAt: string;
    metadata: Record<string, unknown>;
  }>;
  findings: Array<{
    id: string;
    status: string;
    signalType: string;
    severity: string;
    confidence: number;
    title: string;
    summary: string;
    entityType: string;
    entityId: string | null;
    evidence: string[];
    hitlRequestId: string | null;
    hitlDecisionStatus: string | null;
  }>;
}

function formatDateTime(value: string): string {
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) {
    return value;
  }
  return asDate.toLocaleString();
}

function statusClass(status: string): string {
  if (status === 'error') return 'text-red-400 border-red-500/30 bg-red-500/10';
  if (status === 'pending' || status === 'pending_approval') return 'text-orange-300 border-orange-500/30 bg-orange-500/10';
  if (status === 'ok' || status === 'approved' || status === 'resolved') return 'text-green-300 border-green-500/30 bg-green-500/10';
  return 'text-muted border-border';
}

export function FleetGraphTracePage() {
  const { traceId } = useParams<{ traceId: string }>();

  const traceQuery = useQuery<FleetGraphTraceDetailResponse>({
    queryKey: ['fleetgraph-trace-detail', traceId],
    enabled: Boolean(traceId),
    queryFn: async () => {
      const res = await apiGet(`/api/fleetgraph/traces/${traceId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch FleetGraph trace detail');
      }
      return res.json();
    },
  });

  const timeline = useMemo(() => traceQuery.data?.timeline ?? [], [traceQuery.data?.timeline]);
  const findings = useMemo(() => traceQuery.data?.findings ?? [], [traceQuery.data?.findings]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">FleetGraph Trace</h1>
          <p className="text-xs text-muted">
            Internal observability for PRD-relevant execution behavior.
          </p>
        </div>
        <Link to="/my-week" className="text-xs text-accent hover:underline">
          Back to workspace
        </Link>
      </div>

      {traceQuery.isLoading && (
        <div className="rounded border border-border p-3 text-sm text-muted">Loading trace...</div>
      )}

      {traceQuery.isError && (
        <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          FleetGraph trace could not be loaded. Confirm you have access and the trace still exists.
        </div>
      )}

      {traceQuery.data && (
        <>
          <section className="rounded border border-border bg-background/60 p-3">
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted">Trace id</p>
                <p className="text-xs text-foreground">{traceQuery.data.traceId}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted">Branch</p>
                <p className="text-xs text-foreground">{traceQuery.data.run.branch}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted">Trigger</p>
                <p className="text-xs text-foreground">{traceQuery.data.run.trigger}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted">Created</p>
                <p className="text-xs text-foreground">{formatDateTime(traceQuery.data.run.createdAt)}</p>
              </div>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded border border-border p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted">Latency</p>
              <p className="text-sm text-foreground">{traceQuery.data.run.latencyMs}ms</p>
              <p className={`mt-1 inline-flex rounded border px-1.5 py-0.5 text-[10px] ${statusClass(traceQuery.data.observability.withinLatencyBudget ? 'ok' : 'error')}`}>
                {traceQuery.data.observability.withinLatencyBudget
                  ? `Within PRD budget (${traceQuery.data.observability.latencyBudgetMs}ms)`
                  : `Exceeded PRD budget (${traceQuery.data.observability.latencyBudgetMs}ms)`}
              </p>
            </div>
            <div className="rounded border border-border p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted">Signals</p>
              <p className="text-sm text-foreground">{traceQuery.data.observability.signalCount}</p>
              <p className="mt-1 text-[10px] text-muted">
                {(traceQuery.data.observability.signalTypes.length > 0
                  ? traceQuery.data.observability.signalTypes.join(', ')
                  : 'none')}
              </p>
            </div>
            <div className="rounded border border-border p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted">HITL pending</p>
              <p className="text-sm text-foreground">{traceQuery.data.observability.hitlPendingCount}</p>
              <p className="mt-1 text-[10px] text-muted">Human approval queue depth for this run.</p>
            </div>
            <div className="rounded border border-border p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted">Branch marker</p>
              <p className="text-[11px] text-foreground break-all">
                {traceQuery.data.observability.branchDivergenceMarker}
              </p>
            </div>
          </section>

          <section className="rounded border border-border bg-background/60 p-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Timeline</h2>
            <div className="mt-2 space-y-2">
              {timeline.length === 0 && <p className="text-xs text-muted">No trace events recorded.</p>}
              {timeline.map((event, index) => (
                <div key={`${event.phase}-${event.eventName}-${index}`} className="rounded border border-border/70 p-2">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="rounded border border-border px-1.5 py-0.5 text-muted">{event.phase}</span>
                    <span className="text-foreground">{event.eventName}</span>
                    <span className={`rounded border px-1.5 py-0.5 ${statusClass(event.status)}`}>{event.status}</span>
                    {event.latencyMs !== null && <span className="text-muted">latency {event.latencyMs}ms</span>}
                    <span className="ml-auto text-muted">{formatDateTime(event.createdAt)}</span>
                  </div>
                  {Object.keys(event.metadata).length > 0 && (
                    <pre className="mt-1 overflow-x-auto rounded bg-border/20 p-2 text-[10px] text-muted">
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded border border-border bg-background/60 p-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Findings</h2>
            <div className="mt-2 space-y-2">
              {findings.length === 0 && <p className="text-xs text-muted">No findings captured for this run.</p>}
              {findings.map((finding) => (
                <div key={finding.id} className="rounded border border-border/70 p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-medium text-foreground">{finding.title}</p>
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] ${statusClass(finding.status)}`}>
                      {finding.status}
                    </span>
                    <span className="text-[10px] text-muted">
                      {finding.signalType} · {finding.severity} · {(finding.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted">{finding.summary}</p>
                  {finding.evidence.length > 0 && (
                    <ul className="mt-1 list-disc list-inside space-y-0.5 text-[10px] text-muted">
                      {finding.evidence.slice(0, 5).map((evidenceEntry) => (
                        <li key={`${finding.id}-${evidenceEntry}`}>{evidenceEntry}</li>
                      ))}
                    </ul>
                  )}
                  {finding.entityId && (
                    <Link to={`/documents/${finding.entityId}`} className="mt-1 inline-block text-[10px] text-accent hover:underline">
                      Open related document
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
