import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';

interface FleetGraphSignal {
  type: string;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  title: string;
  summary: string;
  evidence: string[];
}

interface FleetGraphRunResponse {
  summary: string;
  run: {
    traceUrl: string;
    latencyMs: number;
    branch: string;
  };
  signals: FleetGraphSignal[];
  hitlRequestId?: string;
}

interface FleetGraphFinding {
  id: string;
  status: string;
  signalType: string;
  severity: string;
  confidence: number;
  title: string;
  summary: string;
  traceUrl: string;
  updatedAt: string;
}

interface FindingsResponse {
  findings: FleetGraphFinding[];
}

interface FleetGraphMetrics {
  runCount: number;
  avgLatencyMs: number;
  totalTokenEstimate: number;
  totalCostEstimateUsd: number;
  monthlyProjectionUsd: {
    users100: number;
    users1000: number;
    users10000: number;
  };
}

interface FleetGraphTraceRun {
  runId: string;
  trigger: string;
  branch: string;
  traceUrl: string;
  latencyMs: number;
  createdAt: string;
}

interface FleetGraphTraceResponse {
  runs: FleetGraphTraceRun[];
}

interface FleetGraphAssistantProps {
  documentId: string;
  documentType: string;
}

function severityClass(severity: string): string {
  if (severity === 'high') return 'text-red-400 border-red-500/30 bg-red-500/10';
  if (severity === 'medium') return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
  return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
}

export function FleetGraphAssistant({ documentId, documentType }: FleetGraphAssistantProps) {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [lastHitlRequestId, setLastHitlRequestId] = useState<string | null>(null);
  const [hitlNote, setHitlNote] = useState('');

  const findingsQuery = useQuery<FindingsResponse>({
    queryKey: ['fleetgraph-findings'],
    queryFn: async () => {
      const res = await apiGet('/api/fleetgraph/findings');
      if (!res.ok) {
        throw new Error('Failed to fetch FleetGraph findings');
      }
      return res.json();
    },
  });

  const metricsQuery = useQuery<FleetGraphMetrics>({
    queryKey: ['fleetgraph-metrics'],
    queryFn: async () => {
      const res = await apiGet('/api/fleetgraph/metrics');
      if (!res.ok) {
        throw new Error('Failed to fetch FleetGraph metrics');
      }
      return res.json();
    },
  });

  const tracesQuery = useQuery<FleetGraphTraceResponse>({
    queryKey: ['fleetgraph-traces'],
    queryFn: async () => {
      const res = await apiGet('/api/fleetgraph/traces');
      if (!res.ok) {
        throw new Error('Failed to fetch FleetGraph traces');
      }
      return res.json();
    },
  });

  const runMutation = useMutation({
    mutationFn: async (): Promise<FleetGraphRunResponse> => {
      const res = await apiPost('/api/fleetgraph/run', {
        document_id: documentId,
        document_type: documentType,
        prompt: prompt.trim() || undefined,
      });
      if (!res.ok) {
        throw new Error('FleetGraph run failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setLastHitlRequestId(data.hitlRequestId ?? null);
      queryClient.invalidateQueries({ queryKey: ['fleetgraph-findings'] });
      queryClient.invalidateQueries({ queryKey: ['fleetgraph-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['fleetgraph-traces'] });
    },
  });

  const hitlDecisionMutation = useMutation({
    mutationFn: async ({ approve }: { approve: boolean }) => {
      if (!lastHitlRequestId) {
        throw new Error('No HITL request to decide');
      }
      const endpoint = approve
        ? `/api/fleetgraph/hitl/${lastHitlRequestId}/approve`
        : `/api/fleetgraph/hitl/${lastHitlRequestId}/reject`;
      const res = await apiPost(endpoint, { note: hitlNote.trim() || undefined });
      if (!res.ok) {
        throw new Error('Failed to submit HITL decision');
      }
      return res.json();
    },
    onSuccess: () => {
      setLastHitlRequestId(null);
      setHitlNote('');
      queryClient.invalidateQueries({ queryKey: ['fleetgraph-findings'] });
    },
  });

  const runSignals = runMutation.data?.signals ?? [];
  const topFindings = useMemo(() => (findingsQuery.data?.findings ?? []).slice(0, 3), [findingsQuery.data?.findings]);

  return (
    <div className="rounded-lg border border-border bg-background/80 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold tracking-wide text-muted uppercase">FleetGraph</h4>
        <button
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending}
          className="rounded bg-accent px-2 py-1 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {runMutation.isPending ? 'Running...' : 'Run'}
        </button>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Ask for context-aware analysis in this view..."
        rows={2}
        className="w-full rounded border border-border bg-border/30 px-2 py-1.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent resize-none"
      />

      {runMutation.data && (
        <div className="space-y-2">
          <p className="text-xs text-foreground">{runMutation.data.summary}</p>
          <p className="text-[11px] text-muted">
            Branch: {runMutation.data.run.branch} | Latency: {runMutation.data.run.latencyMs}ms
          </p>
          <a
            href={runMutation.data.run.traceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-accent hover:underline"
          >
            Open Trace
          </a>
        </div>
      )}

      {runSignals.length > 0 && (
        <div className="space-y-1.5">
          {runSignals.slice(0, 2).map((signal, idx) => (
            <div key={`${signal.type}-${idx}`} className={`rounded border px-2 py-1.5 ${severityClass(signal.severity)}`}>
              <p className="text-xs font-medium">{signal.title}</p>
              <p className="text-[11px] text-foreground/80 mt-0.5">{signal.summary}</p>
              <p className="text-[10px] text-muted mt-1">Confidence: {(signal.confidence * 100).toFixed(0)}%</p>
            </div>
          ))}
        </div>
      )}

      {lastHitlRequestId && (
        <div className="rounded border border-orange-500/30 bg-orange-500/10 p-2 space-y-2">
          <p className="text-xs text-orange-300">Human approval required for this action.</p>
          <input
            value={hitlNote}
            onChange={(e) => setHitlNote(e.target.value)}
            placeholder="Decision note (optional)"
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <div className="flex gap-2">
            <button
              onClick={() => hitlDecisionMutation.mutate({ approve: true })}
              disabled={hitlDecisionMutation.isPending}
              className="flex-1 rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-500 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={() => hitlDecisionMutation.mutate({ approve: false })}
              disabled={hitlDecisionMutation.isPending}
              className="flex-1 rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-500 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-border pt-2 space-y-1">
        <p className="text-[11px] font-medium text-muted uppercase tracking-wide">Open Findings</p>
        {findingsQuery.isLoading && <p className="text-xs text-muted">Loading findings...</p>}
        {!findingsQuery.isLoading && topFindings.length === 0 && (
          <p className="text-xs text-muted">No open FleetGraph findings.</p>
        )}
        {topFindings.map((finding) => (
          <div key={finding.id} className="rounded border border-border px-2 py-1.5">
            <p className="text-xs text-foreground font-medium">{finding.title}</p>
            <p className="text-[11px] text-muted">{finding.summary}</p>
          </div>
        ))}
      </div>

      {metricsQuery.data && (
        <div className="border-t border-border pt-2 space-y-1">
          <p className="text-[11px] font-medium text-muted uppercase tracking-wide">Cost + Performance</p>
          <p className="text-[11px] text-muted">
            Runs: {metricsQuery.data.runCount} | Avg latency: {Math.round(metricsQuery.data.avgLatencyMs)}ms
          </p>
          <p className="text-[11px] text-muted">
            Tokens: {metricsQuery.data.totalTokenEstimate.toLocaleString()} | Spend est: ${metricsQuery.data.totalCostEstimateUsd.toFixed(3)}
          </p>
          <p className="text-[11px] text-muted">
            Monthly projection: ${metricsQuery.data.monthlyProjectionUsd.users100.toFixed(0)} / ${metricsQuery.data.monthlyProjectionUsd.users1000.toFixed(0)} / ${metricsQuery.data.monthlyProjectionUsd.users10000.toFixed(0)}
          </p>
        </div>
      )}

      {tracesQuery.data && tracesQuery.data.runs.length > 0 && (
        <div className="border-t border-border pt-2 space-y-1">
          <p className="text-[11px] font-medium text-muted uppercase tracking-wide">Recent Traces</p>
          {tracesQuery.data.runs.slice(0, 2).map((run) => (
            <a
              key={run.runId}
              href={run.traceUrl}
              target="_blank"
              rel="noreferrer"
              className="block rounded border border-border px-2 py-1 text-[11px] text-accent hover:bg-border/30"
            >
              {run.branch} ({run.trigger})
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
