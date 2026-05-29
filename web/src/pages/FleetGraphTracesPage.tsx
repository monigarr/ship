import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import {
  formatFleetGraphDateTime,
  getFleetGraphSeverityTone,
  getFleetGraphStatusTone,
  resolveExternalTraceHref,
  resolveInternalTraceHref,
} from '@/lib/fleetgraphVisuals';

type SortBy = 'createdAt' | 'latencyMs' | 'status' | 'severity' | 'signalCount' | 'trace';
type SortDir = 'asc' | 'desc';

interface FleetGraphTraceRun {
  runId: string;
  traceId?: string | null;
  trigger: string;
  branch: string;
  traceUrl?: string | null;
  externalTraceUrl?: string | null;
  latencyMs: number;
  createdAt: string;
  status: string;
  severity: string;
  signalCount: number;
  topSignal?: {
    title: string;
    summary: string;
    signalType: string;
    status: string;
    severity: string;
    confidence: number;
  } | null;
  affectedRecord?: {
    entityType: string;
    entityId: string | null;
    title: string;
    href: string | null;
  } | null;
  nextAction?: string;
  audience?: Array<{
    role: string;
    reason: string;
  }>;
}

interface FleetGraphTraceListResponse {
  runs: FleetGraphTraceRun[];
  total: number;
  limit: number;
  offset: number;
}

const DEFAULT_LIMIT = 25;
const STATUS_OPTIONS = ['', 'pending_approval', 'attention', 'resolved', 'no_findings'];
const SEVERITY_OPTIONS = ['', 'high', 'medium', 'low', 'none'];
const SORT_FIELDS: Array<{ id: SortBy; label: string }> = [
  { id: 'createdAt', label: 'Created' },
  { id: 'latencyMs', label: 'Latency' },
  { id: 'status', label: 'Status' },
  { id: 'severity', label: 'Severity' },
  { id: 'signalCount', label: 'Signals' },
  { id: 'trace', label: 'Trace' },
];

function formatRoleLabel(role: string): string {
  return role
    .split('_')
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function sanitizeSortBy(value: string | null): SortBy {
  return value === 'latencyMs' ||
    value === 'status' ||
    value === 'severity' ||
    value === 'signalCount' ||
    value === 'trace'
    ? value
    : 'createdAt';
}

function sanitizeSortDir(value: string | null): SortDir {
  return value === 'asc' ? 'asc' : 'desc';
}

function parseNumberParam(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function resolveRowTraceId(run: FleetGraphTraceRun): string | undefined {
  const traceId = run.traceId?.trim();
  if (traceId) return traceId;

  const traceUrl = run.traceUrl?.trim();
  try {
    const parsed = new URL(traceUrl || '', 'https://ship.local');
    const prefix = '/fleetgraph/traces/';
    if (parsed.pathname.startsWith(prefix)) {
      return parsed.pathname.slice(prefix.length).split('/')[0] || undefined;
    }
    const apiPrefix = '/api/fleetgraph/traces/';
    if (parsed.pathname.startsWith(apiPrefix)) {
      return parsed.pathname.slice(apiPrefix.length).split('/')[0] || undefined;
    }
  } catch {
    // Fall through to run id fallback.
  }

  return run.runId?.trim() || undefined;
}

function formatTraceLabel(traceId?: string): string {
  if (!traceId) return 'Trace unavailable';
  return `Trace ${traceId}`;
}

export function FleetGraphTracesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sortBy = sanitizeSortBy(searchParams.get('sortBy'));
  const sortDir = sanitizeSortDir(searchParams.get('sortDir'));
  const status = searchParams.get('status') ?? '';
  const severity = searchParams.get('severity') ?? '';
  const trace = searchParams.get('trace') ?? searchParams.get('q') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const minLatencyMs = parseNumberParam(searchParams.get('minLatencyMs'));
  const maxLatencyMs = parseNumberParam(searchParams.get('maxLatencyMs'));
  const minSignalCount = parseNumberParam(searchParams.get('minSignalCount'));
  const maxSignalCount = parseNumberParam(searchParams.get('maxSignalCount'));
  const limit = parseNumberParam(searchParams.get('limit')) ?? DEFAULT_LIMIT;
  const offset = parseNumberParam(searchParams.get('offset')) ?? 0;

  const queryString = useMemo(() => {
    const query = new URLSearchParams();
    query.set('sortBy', sortBy);
    query.set('sortDir', sortDir);
    query.set('limit', String(limit));
    query.set('offset', String(offset));
    if (status) query.set('status', status);
    if (severity) query.set('severity', severity);
    if (trace.trim()) query.set('trace', trace.trim());
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    if (typeof minLatencyMs === 'number') query.set('minLatencyMs', String(minLatencyMs));
    if (typeof maxLatencyMs === 'number') query.set('maxLatencyMs', String(maxLatencyMs));
    if (typeof minSignalCount === 'number') query.set('minSignalCount', String(minSignalCount));
    if (typeof maxSignalCount === 'number') query.set('maxSignalCount', String(maxSignalCount));
    return query.toString();
  }, [
    from,
    limit,
    maxLatencyMs,
    maxSignalCount,
    minLatencyMs,
    minSignalCount,
    offset,
    severity,
    sortBy,
    sortDir,
    status,
    to,
    trace,
  ]);

  const tracesQuery = useQuery<FleetGraphTraceListResponse>({
    queryKey: ['fleetgraph-traces-index', queryString],
    queryFn: async () => {
      const res = await apiGet(`/api/fleetgraph/traces?${queryString}`);
      if (!res.ok) {
        throw new Error('Failed to fetch FleetGraph traces');
      }
      return res.json();
    },
  });

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value.trim() === '') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    next.set('offset', '0');
    setSearchParams(next);
  };

  const updateSort = (field: SortBy) => {
    const next = new URLSearchParams(searchParams);
    const nextDir: SortDir =
      sortBy === field ? (sortDir === 'asc' ? 'desc' : 'asc') : field === 'createdAt' ? 'desc' : 'asc';
    next.set('sortBy', field);
    next.set('sortDir', nextDir);
    next.set('offset', '0');
    setSearchParams(next);
  };

  const renderSortHeader = (field: SortBy, className = 'px-3 py-2 text-left font-semibold') => {
    const label = SORT_FIELDS.find((item) => item.id === field)?.label ?? field;
    return (
      <th className={className}>
        <button
          type="button"
          onClick={() => updateSort(field)}
          className="inline-flex items-center gap-1 text-left hover:text-foreground"
        >
          {label}
          {sortBy === field && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
        </button>
      </th>
    );
  };

  const pageStart = tracesQuery.data ? tracesQuery.data.offset + 1 : 0;
  const pageEnd = tracesQuery.data
    ? Math.min(tracesQuery.data.total, tracesQuery.data.offset + tracesQuery.data.runs.length)
    : 0;
  const canGoPrevious = offset > 0;
  const canGoNext = tracesQuery.data ? tracesQuery.data.offset + tracesQuery.data.limit < tracesQuery.data.total : false;

  return (
    <div
      className="mx-auto min-h-0 w-full max-w-7xl flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-4"
      data-testid="fleetgraph-traces-scroll-region"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">FleetGraph Traces</h1>
          <p className="text-sm text-muted">
            Enterprise view with server-driven filtering, sorting, and high-contrast status semantics.
          </p>
        </div>
        <Link to="/my-week" className="rounded border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground">
          Back to workspace
        </Link>
      </div>

      <section className="rounded-lg border border-border bg-background/60 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Filters</p>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
          <label className="text-xs text-muted">
            <span className="mb-1 block">Created from</span>
            <input
              type="datetime-local"
              value={from}
              onChange={(event) => updateParam('from', event.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </label>

          <label className="text-xs text-muted">
            <span className="mb-1 block">Created to</span>
            <input
              type="datetime-local"
              value={to}
              onChange={(event) => updateParam('to', event.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </label>

          <label className="text-xs text-muted">
            <span className="mb-1 block">Min latency (ms)</span>
            <input
              value={minLatencyMs ?? ''}
              onChange={(event) => updateParam('minLatencyMs', event.target.value)}
              inputMode="numeric"
              placeholder="0"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </label>

          <label className="text-xs text-muted">
            <span className="mb-1 block">Max latency (ms)</span>
            <input
              value={maxLatencyMs ?? ''}
              onChange={(event) => updateParam('maxLatencyMs', event.target.value)}
              inputMode="numeric"
              placeholder="300000"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </label>

          <label className="text-xs text-muted">
            <span className="mb-1 block">Status</span>
            <select
              value={status}
              onChange={(event) => updateParam('status', event.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {STATUS_OPTIONS.map((value) => (
                <option key={value || 'all'} value={value}>
                  {value ? getFleetGraphStatusTone(value).label : 'All statuses'}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-muted">
            <span className="mb-1 block">Severity</span>
            <select
              value={severity}
              onChange={(event) => updateParam('severity', event.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {SEVERITY_OPTIONS.map((value) => (
                <option key={value || 'all'} value={value}>
                  {value ? getFleetGraphSeverityTone(value).label : 'All severities'}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-muted">
            <span className="mb-1 block">Min signals</span>
            <input
              value={minSignalCount ?? ''}
              onChange={(event) => updateParam('minSignalCount', event.target.value)}
              inputMode="numeric"
              placeholder="0"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </label>

          <label className="text-xs text-muted">
            <span className="mb-1 block">Max signals</span>
            <input
              value={maxSignalCount ?? ''}
              onChange={(event) => updateParam('maxSignalCount', event.target.value)}
              inputMode="numeric"
              placeholder="10"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </label>

          <label className="text-xs text-muted xl:col-span-2">
            <span className="mb-1 block">Trace</span>
            <input
              value={trace}
              onChange={(event) => updateParam('trace', event.target.value)}
              placeholder="trace id, branch, or trigger"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </label>
        </div>
      </section>

      <section
        className="rounded-lg border border-border bg-background/60"
        aria-live="polite"
      >
        <div className="max-w-full overflow-x-auto pb-1" data-testid="fleetgraph-traces-table-scroll">
          <table className="w-full min-w-[1280px]">
            <thead className="border-b border-border bg-border/20 text-xs uppercase tracking-wide text-muted">
              <tr>
                {renderSortHeader('createdAt')}
                {renderSortHeader('trace', 'min-w-[240px] px-3 py-2 text-left font-semibold')}
                {renderSortHeader('status')}
                {renderSortHeader('severity')}
                <th className="px-3 py-2 text-left font-semibold">Top Signal</th>
                <th className="px-3 py-2 text-left font-semibold">Affected Record</th>
                <th className="px-3 py-2 text-left font-semibold">Next Action</th>
                <th className="px-3 py-2 text-left font-semibold">Owner / Audience</th>
                {renderSortHeader('signalCount')}
                {renderSortHeader('latencyMs')}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/80 text-sm">
              {tracesQuery.isLoading && (
                <tr>
                  <td colSpan={10} className="px-3 py-4 text-muted">
                    Loading traces...
                  </td>
                </tr>
              )}
              {tracesQuery.isError && (
                <tr>
                  <td colSpan={10} className="px-3 py-4 text-red-200">
                    Trace index could not be loaded. Please refresh or verify access.
                  </td>
                </tr>
              )}
              {tracesQuery.data?.runs.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-4 text-muted">
                    No traces match the current filters.
                  </td>
                </tr>
              )}
              {tracesQuery.data?.runs.map((run) => {
                const statusTone = getFleetGraphStatusTone(run.status);
                const severityTone = getFleetGraphSeverityTone(run.severity);
                const traceId = resolveRowTraceId(run);
                const traceHref = resolveInternalTraceHref(run.traceUrl, traceId);
                const externalTraceHref = resolveExternalTraceHref(run.externalTraceUrl);
                return (
                  <tr key={run.runId} className="hover:bg-border/10">
                    <td className="px-3 py-2 text-muted">{formatFleetGraphDateTime(run.createdAt)}</td>
                    <td className="min-w-[240px] max-w-[320px] px-3 py-2 align-top">
                      {traceId ? (
                        <Link
                          to={traceHref}
                          className="break-all text-accent hover:underline"
                          aria-label={`Open FleetGraph trace ${traceId}`}
                          title={traceId}
                        >
                          {formatTraceLabel(traceId)}
                        </Link>
                      ) : (
                        <span className="text-muted">{formatTraceLabel(traceId)}</span>
                      )}
                      <p className="mt-0.5 text-[11px] text-muted">{run.branch} ({run.trigger})</p>
                      {externalTraceHref && (
                        <a
                          href={externalTraceHref}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex rounded border border-border px-1.5 py-0.5 text-[10px] text-muted hover:text-foreground"
                        >
                          View in LangSmith
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded border px-2 py-0.5 text-xs ${statusTone.className}`}>
                        {statusTone.label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded border px-2 py-0.5 text-xs ${severityTone.className}`}>
                        {severityTone.label}
                      </span>
                    </td>
                    <td className="max-w-[260px] px-3 py-2">
                      {run.topSignal ? (
                        <>
                          <p className="line-clamp-2 text-xs font-medium text-foreground">{run.topSignal.title}</p>
                          <p className="mt-0.5 text-[11px] text-muted">{run.topSignal.signalType}</p>
                        </>
                      ) : (
                        <span className="text-xs text-muted">No actionable signal</span>
                      )}
                    </td>
                    <td className="max-w-[220px] px-3 py-2">
                      {run.affectedRecord?.href ? (
                        <Link to={run.affectedRecord.href} className="text-xs text-accent hover:underline">
                          {run.affectedRecord.title}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted">{run.affectedRecord?.title ?? 'Workspace'}</span>
                      )}
                      <p className="mt-0.5 text-[11px] text-muted">{run.affectedRecord?.entityType ?? 'workspace'}</p>
                    </td>
                    <td className="max-w-[260px] px-3 py-2 text-xs text-foreground">{run.nextAction ?? 'No action needed'}</td>
                    <td className="max-w-[220px] px-3 py-2">
                      {run.audience && run.audience.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {run.audience.slice(0, 3).map((draft) => (
                            <span
                              key={`${run.runId}-${draft.role}`}
                              title={draft.reason}
                              className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted"
                            >
                              {formatRoleLabel(draft.role)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted">No audience</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted">{run.signalCount}</td>
                    <td className="px-3 py-2 text-foreground">{run.latencyMs}ms</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted">
          <p>
            Showing {pageStart}-{pageEnd} of {tracesQuery.data?.total ?? 0}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canGoPrevious}
              onClick={() => updateParam('offset', String(Math.max(0, offset - limit)))}
              className="rounded border border-border px-2 py-1 text-xs text-foreground disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => updateParam('offset', String(offset + limit))}
              className="rounded border border-border px-2 py-1 text-xs text-foreground disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
