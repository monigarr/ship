import { Fragment, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import {
  formatFleetGraphDateTime,
  getFleetGraphSeverityTone,
  getFleetGraphStatusTone,
  resolveExternalTraceHref,
} from '@/lib/fleetgraphVisuals';

interface FleetGraphTraceDetailResponse {
  traceId: string;
  traceUrl: string;
  externalTraceUrl: string | null;
  run: {
    runId: string;
    trigger: string;
    branch: string;
    latencyMs: number;
    externalTraceUrl: string | null;
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
    branchExplanation: string;
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
    affectedRecord?: {
      entityType: string;
      entityId: string | null;
      title: string;
      href: string | null;
    } | null;
    evidence: string[];
    evidenceChecklist?: Array<{
      label: string;
      value: string;
      status: 'present' | 'attention' | 'missing';
    }>;
    hitlRequestId: string | null;
    hitlDecisionStatus: string | null;
    hitlState?: {
      label: string;
      status: 'not_required' | 'pending' | 'approved' | 'rejected';
      requiresAction: boolean;
    };
    notificationDrafts?: Array<{
      role: string;
      reason: string;
    }>;
  }>;
}

function valueToLabel(value: unknown): string {
  if (value === null || value === undefined) return 'n/a';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.join(', ');
  return JSON.stringify(value);
}

function formatRoleLabel(role: string): string {
  return role
    .split('_')
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function getChecklistTone(status: 'present' | 'attention' | 'missing'): string {
  if (status === 'present') return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200';
  if (status === 'attention') return 'border-amber-500/35 bg-amber-500/10 text-amber-200';
  return 'border-red-500/35 bg-red-500/10 text-red-200';
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
  const externalTraceHref = resolveExternalTraceHref(
    traceQuery.data?.externalTraceUrl ?? traceQuery.data?.run.externalTraceUrl ?? null
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl space-y-4 p-4 pb-20">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">FleetGraph Trace Detail</h1>
          <p className="text-sm text-muted">
            Dark-optimized observability timeline with status and severity signals for operator review.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {externalTraceHref && (
            <a
              href={externalTraceHref}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-border px-2.5 py-1 text-xs text-muted hover:text-foreground"
            >
              View in LangSmith
            </a>
          )}
          <a
            href={`/api/fleetgraph/traces/${traceQuery.data?.traceId ?? traceId ?? ''}`}
            className="rounded border border-border px-2.5 py-1 text-xs text-muted hover:text-foreground"
          >
            API JSON
          </a>
          <Link to="/fleetgraph/traces" className="rounded border border-border px-2.5 py-1 text-xs text-foreground hover:bg-border/30">
            Back to traces
          </Link>
          <Link to="/my-week" className="rounded border border-border px-2.5 py-1 text-xs text-muted hover:text-foreground">
            Workspace
          </Link>
        </div>
      </div>

      {traceQuery.isLoading && (
        <div aria-live="polite" className="rounded border border-border p-3 text-sm text-muted">
          Loading trace...
        </div>
      )}

      {traceQuery.isError && (
        <div aria-live="assertive" className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          FleetGraph trace could not be loaded. Confirm you have access and the trace still exists.
        </div>
      )}

      {traceQuery.data && (
        <>
          <section className="rounded border border-border bg-background/60 p-3">
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted">Trace id</p>
                <p className="text-xs text-foreground break-all">{traceQuery.data.traceId}</p>
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
                <p className="text-xs text-foreground">{formatFleetGraphDateTime(traceQuery.data.run.createdAt)}</p>
              </div>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded border border-border p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted">Latency</p>
              <p className="text-base font-medium text-foreground">{traceQuery.data.run.latencyMs}ms</p>
              <p
                className={`mt-1 inline-flex rounded border px-1.5 py-0.5 text-[10px] ${
                  getFleetGraphStatusTone(traceQuery.data.observability.withinLatencyBudget ? 'resolved' : 'attention').className
                }`}
              >
                {traceQuery.data.observability.withinLatencyBudget
                  ? `Within PRD budget (${traceQuery.data.observability.latencyBudgetMs}ms)`
                  : `Exceeded PRD budget (${traceQuery.data.observability.latencyBudgetMs}ms)`}
              </p>
            </div>
            <div className="rounded border border-border p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted">Signals</p>
              <p className="text-base font-medium text-foreground">{traceQuery.data.observability.signalCount}</p>
              <p className="mt-1 text-[10px] text-muted">
                {(traceQuery.data.observability.signalTypes.length > 0
                  ? traceQuery.data.observability.signalTypes.join(', ')
                  : 'none')}
              </p>
            </div>
            <div className="rounded border border-border p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted">HITL pending</p>
              <p className="text-base font-medium text-foreground">{traceQuery.data.observability.hitlPendingCount}</p>
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
            <p className="text-[11px] uppercase tracking-wide text-muted">Branch explanation</p>
            <p className="mt-1 text-sm text-foreground">{traceQuery.data.observability.branchExplanation}</p>
          </section>

          <section className="rounded border border-border bg-background/60 p-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Timeline</h2>
            <div className="mt-2 space-y-2">
              {timeline.length === 0 && <p className="text-xs text-muted">No trace events recorded.</p>}
              {timeline.map((event, index) => (
                <div key={`${event.phase}-${event.eventName}-${index}`} className="rounded border border-border/70 bg-background/40 p-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="rounded border border-border px-1.5 py-0.5 text-muted">{event.phase}</span>
                    <span className="font-medium text-foreground">{event.eventName}</span>
                    <span
                      className={`rounded border px-1.5 py-0.5 ${
                        getFleetGraphStatusTone(event.status).className
                      }`}
                    >
                      {getFleetGraphStatusTone(event.status).label}
                    </span>
                    {event.latencyMs !== null && <span className="text-muted">latency {event.latencyMs}ms</span>}
                    <span className="ml-auto text-muted">{formatFleetGraphDateTime(event.createdAt)}</span>
                  </div>
                  {Object.keys(event.metadata).length > 0 && (
                    <div className="mt-2 grid gap-1 sm:grid-cols-2">
                      {Object.entries(event.metadata).map(([key, value]) => (
                        <div key={`${event.eventName}-${key}`} className="rounded border border-border/60 bg-border/10 px-2 py-1">
                          <p className="text-[10px] uppercase tracking-wide text-muted">{key}</p>
                          <p className="text-[11px] text-foreground break-words">{valueToLabel(value)}</p>
                        </div>
                      ))}
                    </div>
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
                <div key={finding.id} className="rounded border border-border/70 bg-background/40 p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{finding.title}</p>
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] ${
                        getFleetGraphStatusTone(finding.status).className
                      }`}
                    >
                      {getFleetGraphStatusTone(finding.status).label}
                    </span>
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] ${
                        getFleetGraphSeverityTone(finding.severity).className
                      }`}
                    >
                      Severity: {getFleetGraphSeverityTone(finding.severity).label}
                    </span>
                    <span className="text-[10px] text-muted">{finding.signalType} · {(finding.confidence * 100).toFixed(0)}%</span>
                    {finding.hitlState && (
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] ${
                          getFleetGraphStatusTone(finding.hitlState.status).className
                        }`}
                      >
                        {finding.hitlState.label}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted">{finding.summary}</p>

                  <div className="mt-2 grid gap-2 md:grid-cols-3">
                    <div className="rounded border border-border/60 bg-border/10 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted">Affected record</p>
                      {finding.affectedRecord?.href ? (
                        <Link to={finding.affectedRecord.href} className="mt-1 block text-[11px] text-accent hover:underline">
                          {finding.affectedRecord.title}
                        </Link>
                      ) : (
                        <p className="mt-1 text-[11px] text-foreground">{finding.affectedRecord?.title ?? 'Workspace'}</p>
                      )}
                      <p className="mt-0.5 text-[10px] text-muted">{finding.affectedRecord?.entityType ?? finding.entityType}</p>
                    </div>

                    <div className="rounded border border-border/60 bg-border/10 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted">HITL state</p>
                      <p className="mt-1 text-[11px] text-foreground">{finding.hitlState?.label ?? 'No protected action'}</p>
                      {finding.hitlRequestId && (
                        <p className="mt-0.5 break-all text-[10px] text-muted">{finding.hitlRequestId}</p>
                      )}
                    </div>

                    <div className="rounded border border-border/60 bg-border/10 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted">Owner / audience</p>
                      {finding.notificationDrafts && finding.notificationDrafts.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {finding.notificationDrafts.map((draft) => (
                            <span
                              key={`${finding.id}-${draft.role}`}
                              title={draft.reason}
                              className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted"
                            >
                              {formatRoleLabel(draft.role)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-[11px] text-muted">No audience routed.</p>
                      )}
                    </div>
                  </div>

                  {finding.evidenceChecklist && finding.evidenceChecklist.length > 0 && (
                    <div className="mt-2 rounded border border-border/60 bg-border/10 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted">Evidence checklist</p>
                      <div className="mt-1 grid gap-1 sm:grid-cols-2">
                        {finding.evidenceChecklist.map((item) => (
                          <div
                            key={`${finding.id}-${item.label}-${item.value}`}
                            className={`rounded border px-2 py-1 ${getChecklistTone(item.status)}`}
                          >
                            <p className="text-[10px] uppercase tracking-wide">{item.label}</p>
                            <p className="break-words text-[11px]">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {finding.evidence.length > 0 && (
                    <details className="mt-2 rounded border border-border/60 bg-border/10 p-2">
                      <summary className="cursor-pointer text-[10px] uppercase tracking-wide text-muted">
                        Raw evidence
                      </summary>
                      <ul className="mt-1 list-inside list-disc space-y-0.5 text-[11px] text-muted">
                        {finding.evidence.slice(0, 8).map((evidenceEntry) => (
                          <li key={`${finding.id}-${evidenceEntry}`}>{evidenceEntry}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded border border-border bg-background/60 p-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Run payload</h2>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {([
                ['Run Input', traceQuery.data.run.runInput],
                ['Run Output', traceQuery.data.run.runOutput],
              ] as Array<[string, Record<string, unknown>]>).map(([title, payload]) => (
                <div key={title} className="rounded border border-border/60 bg-border/10 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted">{title}</p>
                  <div className="mt-1 space-y-1 text-[11px]">
                    {Object.keys(payload).length === 0 && (
                      <p className="text-muted">No structured fields.</p>
                    )}
                    {Object.entries(payload).map(([key, value]) => (
                      <Fragment key={key}>
                        <p className="text-muted">{key}</p>
                        <p className="text-foreground break-words">{valueToLabel(value)}</p>
                      </Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
      </div>
    </div>
  );
}
