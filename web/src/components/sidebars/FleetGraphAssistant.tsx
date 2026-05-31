import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import {
  getFleetGraphSeverityTone,
  resolveExternalTraceHref,
  resolveInternalTraceHref,
} from '@/lib/fleetgraphVisuals';

interface FleetGraphSignal {
  type: string;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  title: string;
  summary: string;
  evidence: string[];
  entityType?: string;
  entityId?: string | null;
  requiresHitl?: boolean;
  notificationDrafts?: Array<{ role: string; reason: string }>;
}

interface FleetGraphFinding {
  id: string;
  status: string;
  signalType: string;
  severity: string;
  confidence: number;
  title: string;
  summary: string;
  traceId?: string;
  traceUrl: string;
  externalTraceUrl?: string | null;
  updatedAt: string;
  snoozedUntil?: string | null;
  evidence: string[];
  entityType: string;
  entityId: string | null;
  hitlRequestId: string | null;
  notificationDrafts?: Array<{ role: string; reason: string }>;
}

interface FleetGraphRunResponse {
  summary: string;
  run: {
    traceId: string;
    traceUrl: string;
    externalTraceUrl?: string | null;
    latencyMs: number;
    branch: string;
  };
  signals: FleetGraphSignal[];
  findings?: Array<{
    id: string;
    status: string;
    signal: FleetGraphSignal;
  }>;
  hitlRequestId?: string;
}

interface FindingsResponse {
  findings: FleetGraphFinding[];
}

interface FleetGraphMetrics {
  runCount: number;
  avgLatencyMs: number;
  tokenTotals: {
    all: number;
    actualModelUsage: number;
    heuristicEstimate: number;
    current30Days: number;
    previous30Days: number;
  };
  spend: {
    runtimeTotalUsd: number;
    billedTotalUsd: number;
    deltaUsd: number | null;
    billedCoverageRuns: number;
    billedCoveragePct: number;
  };
  monthlyProjection: {
    basis: 'trailing_30_day_daily_average';
    runtimeUsd: number;
    billedUsd: number | null;
    deltaUsd: number | null;
  };
  modelUsage: Array<{
    modelId: string;
    runCount: number;
    tokenTotal: number;
    runtimeSpendUsd: number;
    billedSpendUsd: number;
    tokenSource: 'actual_model_usage' | 'heuristic_estimate';
  }>;
}

interface FleetGraphTraceRun {
  runId: string;
  traceId?: string;
  trigger: string;
  branch: string;
  traceUrl: string;
  externalTraceUrl?: string | null;
  latencyMs: number;
  createdAt: string;
}

interface FleetGraphTraceResponse {
  runs: FleetGraphTraceRun[];
}

interface FleetGraphAssistantProps {
  documentId?: string | null;
  documentType?: string | null;
  contextLabel?: string;
  className?: string;
}

type ChatMessage =
  | { role: 'user'; text: string; at: string }
  | {
      role: 'assistant';
      summary: string;
      signals: FleetGraphSignal[];
      run: FleetGraphRunResponse['run'];
      at: string;
    };

interface HitlTarget {
  hitlRequestId: string;
  findingId: string;
  signalType: string;
  severity: string;
  confidence: number;
  title: string;
  summary: string;
  evidence: string[];
  entityType: string;
  entityId: string | null;
  runSummary?: string;
}

const QUICK_PROMPTS: Record<string, string[]> = {
  issue: ['What should happen next?', 'Summarize blockers and owners'],
  project: ['Is our hypothesis still valid?', 'What delivery risks exist?'],
  sprint: ["Review this week's commitments", 'What is overdue for approval?'],
};

const REQUEST_CHANGES_TEMPLATE =
  'Requesting changes before approval: please revise the proposed action and resubmit evidence.';

function severityClass(severity: string): string {
  return getFleetGraphSeverityTone(severity).className;
}

function formatEntityType(documentType: string): string {
  if (documentType === 'sprint') return 'sprint';
  return documentType.replace(/_/g, ' ');
}

function proposedActionLabel(signalType: string, title: string): string {
  if (signalType === 'compliance_risk') {
    return `Confirm compliance action: ${title}`;
  }
  return title;
}

function tokenSourceLabel(value: 'actual_model_usage' | 'heuristic_estimate'): string {
  return value === 'actual_model_usage' ? 'actual model usage' : 'heuristic estimate';
}

function findingToHitlTarget(finding: FleetGraphFinding): HitlTarget | null {
  if (!finding.hitlRequestId || finding.status !== 'pending_approval') {
    return null;
  }

  return {
    hitlRequestId: finding.hitlRequestId,
    findingId: finding.id,
    signalType: finding.signalType,
    severity: finding.severity,
    confidence: finding.confidence,
    title: finding.title,
    summary: finding.summary,
    evidence: finding.evidence,
    entityType: finding.entityType,
    entityId: finding.entityId,
  };
}

function SignalCard({ signal }: { signal: FleetGraphSignal }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded border px-2 py-1.5 ${severityClass(signal.severity)}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{signal.title}</p>
        <span className="text-xs uppercase tracking-wide opacity-80">{signal.severity}</span>
      </div>
      <p className="mt-0.5 text-sm text-foreground/80">{signal.summary}</p>
      <p className="mt-1 text-xs text-muted">
        Confidence: {(signal.confidence * 100).toFixed(0)}%
        {signal.entityType && (
          <>
            {' '}
            | {signal.entityType}
            {signal.entityId ? `: ${signal.entityId.slice(0, 8)}…` : ''}
          </>
        )}
      </p>
      {signal.evidence.length > 0 && (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="text-xs text-accent hover:underline"
          >
            {expanded ? 'Hide evidence' : `Show evidence (${signal.evidence.length})`}
          </button>
          {expanded && (
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-muted">
              {signal.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {signal.notificationDrafts && signal.notificationDrafts.length > 0 && (
        <div className="mt-1.5 rounded border border-border/60 bg-background/40 px-1.5 py-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Suggested notify</p>
          <ul className="mt-0.5 space-y-0.5 text-xs text-muted">
            {signal.notificationDrafts.map((draft) => (
              <li key={`${draft.role}-${draft.reason}`}>
                <span className="text-foreground/90">{draft.role.replace(/_/g, ' ')}</span>: {draft.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function HitlGate({
  target,
  note,
  onNoteChange,
  onApprove,
  onReject,
  onRequestChanges,
  onSnooze,
  onClose,
  isPending,
}: {
  target: HitlTarget;
  note: string;
  onNoteChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onRequestChanges: () => void;
  onSnooze: () => void;
  onClose: () => void;
  isPending: boolean;
}) {
  return (
    <div className="rounded border border-orange-500/30 bg-orange-500/10 p-2 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-orange-300">Human approval required</p>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-muted hover:text-foreground"
        >
          Close
        </button>
      </div>

      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted">Proposed action</p>
        <p className="text-sm text-foreground">
          {proposedActionLabel(target.signalType, target.title)}
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted">Rationale</p>
        <p className="text-sm text-foreground/90">{target.summary}</p>
        {target.runSummary && (
          <p className="text-sm text-muted">{target.runSummary}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className={`rounded border px-1.5 py-0.5 ${severityClass(target.severity)}`}>
          {target.severity}
        </span>
        <span className="rounded border border-border px-1.5 py-0.5 text-muted">
          Confidence {(target.confidence * 100).toFixed(0)}%
        </span>
        <span className="rounded border border-border px-1.5 py-0.5 text-muted">
          {target.entityType}
          {target.entityId && (
            <>
              {' '}
              ·{' '}
              <a href={`/documents/${target.entityId}`} className="text-accent hover:underline">
                View record
              </a>
            </>
          )}
        </span>
      </div>

      {target.evidence.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted">Supporting evidence</p>
          <ul className="list-inside list-disc space-y-0.5 text-xs text-muted">
            {target.evidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="Decision note (optional)"
        rows={2}
        className="w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
      />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onApprove}
          disabled={isPending}
          className="rounded bg-green-600 px-2 py-1.5 text-sm text-white hover:bg-green-500 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={isPending}
          className="rounded bg-red-600 px-2 py-1.5 text-sm text-white hover:bg-red-500 disabled:opacity-50"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={onRequestChanges}
          disabled={isPending}
          className="rounded bg-orange-600 px-2 py-1.5 text-sm text-white hover:bg-orange-500 disabled:opacity-50"
        >
          Request changes
        </button>
        <button
          type="button"
          onClick={onSnooze}
          disabled={isPending}
          className="rounded bg-yellow-600 px-2 py-1.5 text-sm text-white hover:bg-yellow-500 disabled:opacity-50"
        >
          Snooze 24h
        </button>
      </div>
    </div>
  );
}

export function FleetGraphAssistant({
  documentId,
  documentType,
  contextLabel,
  className,
}: FleetGraphAssistantProps) {
  const queryClient = useQueryClient();
  const hasEntityContext = Boolean(documentId && documentType);
  const activeDocumentId = documentId ?? null;
  const activeDocumentType = documentType ?? null;
  const [prompt, setPrompt] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activeHitl, setActiveHitl] = useState<HitlTarget | null>(null);
  const [hitlNote, setHitlNote] = useState('');
  const [decisionBanner, setDecisionBanner] = useState<string | null>(null);

  const findingsQueryKey = ['fleetgraph-findings', activeDocumentId ?? 'workspace'] as const;

  useEffect(() => {
    setPrompt('');
    setChatMessages([]);
    setActiveHitl(null);
    setHitlNote('');
    setDecisionBanner(null);
  }, [activeDocumentId, activeDocumentType]);

  const findingsQuery = useQuery<FindingsResponse>({
    queryKey: findingsQueryKey,
    enabled: hasEntityContext && Boolean(activeDocumentId),
    queryFn: async () => {
      const res = await apiGet(`/api/fleetgraph/findings?entity_id=${encodeURIComponent(activeDocumentId ?? '')}`);
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

  const scopedFindings = useMemo(() => {
    if (!activeDocumentId) {
      return [];
    }
    const findings = findingsQuery.data?.findings ?? [];
    return findings.filter(
      (finding) => finding.entityId === activeDocumentId || finding.entityId === null
    );
  }, [findingsQuery.data?.findings, activeDocumentId]);

  const quickPrompts = activeDocumentType ? (QUICK_PROMPTS[activeDocumentType] ?? QUICK_PROMPTS.issue) : [];

  const invalidateFleetGraphQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: findingsQueryKey });
    queryClient.invalidateQueries({ queryKey: ['fleetgraph-metrics'] });
    queryClient.invalidateQueries({ queryKey: ['fleetgraph-traces'] });
  }, [queryClient, findingsQueryKey]);

  const runMutation = useMutation({
    mutationFn: async (promptText: string): Promise<FleetGraphRunResponse> => {
      const res = await apiPost('/api/fleetgraph/run', {
        document_id: activeDocumentId,
        document_type: activeDocumentType,
        prompt: promptText.trim() || undefined,
      });
      if (!res.ok) {
        throw new Error('FleetGraph run failed');
      }
      return res.json();
    },
    onSuccess: (data, promptText) => {
      const at = new Date().toISOString();
      setChatMessages((messages) => [
        ...messages,
        { role: 'user', text: promptText, at },
        {
          role: 'assistant',
          summary: data.summary,
          signals: data.signals,
          run: data.run,
          at,
        },
      ]);
      setPrompt('');

      const pendingFinding = data.findings?.find((finding) => finding.status === 'pending_approval');
      if (data.hitlRequestId && pendingFinding) {
        setActiveHitl({
          hitlRequestId: data.hitlRequestId,
          findingId: pendingFinding.id,
          signalType: pendingFinding.signal.type,
          severity: pendingFinding.signal.severity,
          confidence: pendingFinding.signal.confidence,
          title: pendingFinding.signal.title,
          summary: pendingFinding.signal.summary,
          evidence: pendingFinding.signal.evidence,
          entityType: pendingFinding.signal.entityType ?? activeDocumentType ?? 'document',
          entityId: pendingFinding.signal.entityId ?? activeDocumentId,
          runSummary: data.summary,
        });
        setHitlNote('');
      }

      invalidateFleetGraphQueries();
    },
  });

  const hitlDecisionMutation = useMutation({
    mutationFn: async ({
      hitlRequestId,
      approve,
      note,
    }: {
      hitlRequestId: string;
      approve: boolean;
      note?: string;
    }) => {
      const endpoint = approve
        ? `/api/fleetgraph/hitl/${hitlRequestId}/approve`
        : `/api/fleetgraph/hitl/${hitlRequestId}/reject`;
      const res = await apiPost(endpoint, { note: note?.trim() || undefined });
      if (!res.ok) {
        throw new Error('Failed to submit HITL decision');
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      setActiveHitl(null);
      setHitlNote('');
      setDecisionBanner(variables.approve ? 'Action approved.' : 'Action rejected.');
      invalidateFleetGraphQueries();
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: async ({ findingId, note }: { findingId: string; note?: string }) => {
      const res = await apiPost(`/api/fleetgraph/findings/${findingId}/snooze`, {
        hours: 24,
        note: note?.trim() || undefined,
      });
      if (!res.ok) {
        throw new Error('Failed to snooze finding');
      }
      return res.json();
    },
    onSuccess: () => {
      setActiveHitl(null);
      setHitlNote('');
      setDecisionBanner('Finding snoozed for 24 hours.');
      invalidateFleetGraphQueries();
    },
  });

  const submitPrompt = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!hasEntityContext || !trimmed || runMutation.isPending) {
        return;
      }
      runMutation.mutate(trimmed);
    },
    [hasEntityContext, runMutation]
  );

  const handlePromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitPrompt(prompt);
    }
  };

  const openFindingHitl = (finding: FleetGraphFinding) => {
    const target = findingToHitlTarget(finding);
    if (target) {
      setActiveHitl(target);
      setHitlNote('');
      setDecisionBanner(null);
    }
  };

  const contextDisplay = contextLabel?.trim() || (activeDocumentId ? activeDocumentId.slice(0, 8) : 'No active context');
  const showNoContextFallback = !hasEntityContext;

  return (
    <div className={`rounded-2xl border border-border/60 bg-background/95 shadow-xl shadow-black/5 backdrop-blur-sm p-4 space-y-4 ring-1 ring-inset ring-white/5 flex min-h-0 flex-col ${className ?? ''}`}>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            <h4 className="text-sm font-semibold tracking-tight text-foreground">FleetGraph</h4>
          </div>
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium uppercase tracking-[0.5px] text-accent">On-demand</span>
        </div>
        {showNoContextFallback ? (
          <p className="text-sm text-muted">Context required to run FleetGraph for a specific record.</p>
        ) : (
          <p className="text-sm text-muted">
            Scoped to {formatEntityType(activeDocumentType ?? 'record')}:{' '}
            <span className="text-foreground">{contextDisplay}</span>
          </p>
        )}
      </div>

      {showNoContextFallback && (
        <div className="rounded border border-border/70 bg-border/10 px-3 py-2">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-accent" aria-hidden="true">
              <NoContextIcon />
            </span>
            <p className="text-sm text-muted">
              View an Issue, Project, or Sprint for FleetGraph support. Workspace diagnostics and traces remain available.
            </p>
          </div>
        </div>
      )}

      {decisionBanner && (
        <div className="rounded border border-green-500/30 bg-green-500/10 px-2 py-1.5 text-sm text-green-300">
          {decisionBanner}
        </div>
      )}

      <div className="fleetgraph-drawer-scroll space-y-3 flex-1 overflow-y-auto rounded-2xl border border-border/50 bg-background/40 p-3 shadow-inner min-h-[15rem]">
        {chatMessages.length === 0 && !runMutation.isPending && (
          <p className="text-sm text-muted">
            {showNoContextFallback
              ? 'Select an Issue, Project, or Sprint to ask context-scoped FleetGraph questions.'
              : `Ask about this ${formatEntityType(activeDocumentType ?? 'record')} — FleetGraph answers from records you can access in this view.`}
          </p>
        )}

        {chatMessages.map((message, index) =>
          message.role === 'user' ? (
            <div key={`user-${index}`} className="flex justify-end">
              <div className="max-w-[90%] rounded-lg bg-accent/20 px-3 py-1.5 text-sm text-foreground">
                {message.text}
              </div>
            </div>
          ) : (
            <div key={`assistant-${index}`} className="space-y-1.5">
              <div className="rounded-lg border border-border bg-background/70 px-2.5 py-2">
                <p className="text-sm text-foreground">{message.summary}</p>
                <p className="mt-1 text-xs text-muted">
                  Branch: {message.run.branch} | Latency: {message.run.latencyMs}ms
                </p>
                <a
                  href={resolveInternalTraceHref(message.run.traceUrl, message.run.traceId)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-accent hover:underline"
                >
                  Open trace details
                </a>
                {resolveExternalTraceHref(message.run.externalTraceUrl) && (
                  <a
                    href={resolveExternalTraceHref(message.run.externalTraceUrl) || undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 text-xs text-muted hover:text-foreground hover:underline"
                  >
                    View in LangSmith
                  </a>
                )}
              </div>
              {message.signals.map((signal, signalIndex) => (
                <SignalCard key={`${signal.type}-${signalIndex}`} signal={signal} />
              ))}
            </div>
          )
        )}

        {runMutation.isPending && (
          <div className="space-y-1 animate-pulse">
            <div className="h-3 w-2/3 rounded bg-border/70" />
            <div className="h-8 rounded bg-border/50" />
          </div>
        )}
      </div>

      {runMutation.isError && (
        <p className="text-sm text-red-400">
          FleetGraph could not complete this run. Try again or check your connection.
        </p>
      )}

      <div className="flex flex-wrap gap-1">
        {quickPrompts.map((quickPrompt) => (
          <button
            key={quickPrompt}
            type="button"
            onClick={() => {
              setPrompt(quickPrompt);
              submitPrompt(quickPrompt);
            }}
            disabled={runMutation.isPending || showNoContextFallback}
            className="rounded border border-border px-2 py-0.5 text-[10px] text-muted hover:bg-border/40 hover:text-foreground disabled:opacity-50"
          >
            {quickPrompt}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handlePromptKeyDown}
          placeholder={
            showNoContextFallback
              ? 'Open an Issue, Project, or Sprint to ask FleetGraph'
              : `Ask about this ${formatEntityType(activeDocumentType ?? 'record')}...`
          }
          rows={2}
          disabled={runMutation.isPending || showNoContextFallback}
          className="flex-1 rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/60 resize-y min-h-[52px] disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => submitPrompt(prompt)}
          disabled={runMutation.isPending || !prompt.trim() || showNoContextFallback}
          className="self-end rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent/90 active:scale-[0.985] disabled:opacity-50 transition-all"
        >
          {runMutation.isPending ? '...' : 'Send'}
        </button>
      </div>

      {activeHitl && (
        <HitlGate
          target={activeHitl}
          note={hitlNote}
          onNoteChange={setHitlNote}
          onApprove={() =>
            hitlDecisionMutation.mutate({
              hitlRequestId: activeHitl.hitlRequestId,
              approve: true,
              note: hitlNote,
            })
          }
          onReject={() =>
            hitlDecisionMutation.mutate({
              hitlRequestId: activeHitl.hitlRequestId,
              approve: false,
              note: hitlNote,
            })
          }
          onRequestChanges={() => {
            const note = hitlNote.trim() || REQUEST_CHANGES_TEMPLATE;
            setHitlNote(note);
            hitlDecisionMutation.mutate({
              hitlRequestId: activeHitl.hitlRequestId,
              approve: false,
              note,
            });
          }}
          onSnooze={() =>
            snoozeMutation.mutate({
              findingId: activeHitl.findingId,
              note: hitlNote,
            })
          }
          onClose={() => setActiveHitl(null)}
          isPending={hitlDecisionMutation.isPending || snoozeMutation.isPending}
        />
      )}

      <div className="border-t border-border pt-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Findings for this view
          </p>
          <span className="rounded bg-border px-1.5 py-0.5 text-xs text-muted">
            {scopedFindings.length}
          </span>
        </div>

        {findingsQuery.isLoading && <p className="text-sm text-muted">Loading findings...</p>}
        {!findingsQuery.isLoading && showNoContextFallback && (
          <p className="text-sm text-muted">Context-specific findings appear once an Issue, Project, or Sprint is open.</p>
        )}
        {!findingsQuery.isLoading && scopedFindings.length === 0 && (
          <p className="text-sm text-muted">No open FleetGraph findings for this view.</p>
        )}

        {scopedFindings.map((finding) => (
          <div
            key={finding.id}
            className={`rounded border px-2 py-1.5 space-y-1 ${
              finding.status === 'pending_approval'
                ? 'border-orange-500/40 bg-orange-500/5'
                : 'border-border'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{finding.title}</p>
              <span className={`rounded px-1 text-xs uppercase ${severityClass(finding.severity)}`}>
                {finding.severity}
              </span>
            </div>
            <p className="text-sm text-muted">{finding.summary}</p>
            {finding.evidence.length > 0 && (
              <ul className="list-inside list-disc space-y-0.5 text-xs text-muted">
                {finding.evidence.slice(0, 3).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {finding.notificationDrafts && finding.notificationDrafts.length > 0 && (
              <div className="rounded border border-border/50 bg-background/30 px-1.5 py-1">
                <p className="text-xs font-medium uppercase text-muted">Suggested notify</p>
                <ul className="mt-0.5 space-y-0.5 text-xs text-muted">
                  {finding.notificationDrafts.slice(0, 2).map((draft) => (
                    <li key={`${finding.id}-${draft.role}`}>
                      {draft.role.replace(/_/g, ' ')}: {draft.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {finding.snoozedUntil && (
              <p className="text-xs text-yellow-400">Snoozed until {finding.snoozedUntil}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {finding.status === 'pending_approval' && finding.hitlRequestId && (
                <button
                  type="button"
                  onClick={() => openFindingHitl(finding)}
                  className="rounded bg-orange-600 px-2 py-0.5 text-xs text-white hover:bg-orange-500"
                >
                  Review
                </button>
              )}
              {finding.status !== 'pending_approval' && (
                <button
                  type="button"
                  onClick={() => snoozeMutation.mutate({ findingId: finding.id })}
                  disabled={snoozeMutation.isPending}
                  className="rounded border border-yellow-500/40 px-2 py-0.5 text-xs text-yellow-300 hover:bg-yellow-500/10 disabled:opacity-50"
                >
                  Snooze 24h
                </button>
              )}
              <a
                href={resolveInternalTraceHref(finding.traceUrl, finding.traceId)}
                target="_blank"
                rel="noreferrer"
                className="self-center text-xs text-accent hover:underline"
              >
                Trace details
              </a>
              {resolveExternalTraceHref(finding.externalTraceUrl) && (
                <a
                  href={resolveExternalTraceHref(finding.externalTraceUrl) || undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="self-center text-xs text-muted hover:text-foreground hover:underline"
                >
                  LangSmith
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <details className="border-t border-border pt-2">
        <summary className="cursor-pointer text-sm font-medium uppercase tracking-wide text-muted">
          Diagnostics
        </summary>
        <div className="mt-2 space-y-2">
          <a href="/fleetgraph/traces" className="inline-block text-sm text-accent hover:underline">
            Open full trace index
          </a>
          {metricsQuery.data && (
            <div className="space-y-2 rounded-xl border border-border/60 bg-background/50 p-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border/60 bg-background/60 px-2 py-1.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted">Runs (all-time)</p>
                  <p className="text-sm font-medium text-foreground">{metricsQuery.data.runCount.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/60 px-2 py-1.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted">Avg run latency (ms)</p>
                  <p className="text-sm font-medium text-foreground">
                    {Math.round(metricsQuery.data.avgLatencyMs).toLocaleString()}ms
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-background/60 px-2 py-1.5 space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-muted">Token volume (all-time)</p>
                <p className="text-sm font-medium text-foreground">
                  {metricsQuery.data.tokenTotals.all.toLocaleString()}
                </p>
                <p className="text-xs text-muted">
                  Trailing 30d tokens: {metricsQuery.data.tokenTotals.current30Days.toLocaleString()} | Prior 30d
                  tokens: {metricsQuery.data.tokenTotals.previous30Days.toLocaleString()}
                </p>
              </div>

              <div className="rounded-lg border border-border/60 bg-background/60 px-2 py-1.5 space-y-1">
                <p
                  className="text-xs text-muted"
                  title="Derived from runtime telemetry and may include estimated cost values."
                >
                  Runtime cost (all-time, estimated): $
                  {metricsQuery.data.spend.runtimeTotalUsd.toFixed(3)}
                </p>
                <p
                  className="text-xs text-muted"
                  title="Only includes runs where provider billed values are recorded."
                >
                  Provider billed cost (all-time): ${metricsQuery.data.spend.billedTotalUsd.toFixed(3)}
                </p>
                <p className="text-xs text-muted">Billed minus runtime: {metricsQuery.data.spend.deltaUsd === null
                  ? 'N/A (no billed coverage)'
                  : `$${metricsQuery.data.spend.deltaUsd.toFixed(3)}`}</p>
                <p
                  className="text-xs text-muted"
                  title="Percent of all runs with a non-null billed spend value."
                >
                  Billed coverage: {metricsQuery.data.spend.billedCoverageRuns} run(s) (
                  {metricsQuery.data.spend.billedCoveragePct.toFixed(1)}%)
                </p>
                <p className="text-xs text-muted">
                  Model:{' '}
                  {metricsQuery.data.modelUsage.length > 0
                    ? metricsQuery.data.modelUsage[0]?.modelId
                    : 'None (deterministic only)'}{' '}
                  | Token basis:{' '}
                  {metricsQuery.data.modelUsage.length > 0
                    ? tokenSourceLabel(
                        metricsQuery.data.modelUsage[0]?.tokenSource ?? 'heuristic_estimate'
                      )
                    : 'heuristic estimate'}
                </p>
              </div>

              <div className="rounded-lg border border-accent/30 bg-accent/5 px-2 py-1.5 space-y-1">
                <p
                  className="text-[11px] uppercase tracking-wide text-muted"
                  title="Computed from trailing 30 days and monthlyized; this is not a predictive forecast."
                >
                  Trailing-30d monthlyized spend
                </p>
                <p className="text-xs text-muted">
                  Basis: {metricsQuery.data.monthlyProjection.basis.replaceAll('_', ' ')}
                </p>
                <p className="text-sm font-medium text-foreground">
                  Runtime (30d): ${metricsQuery.data.monthlyProjection.runtimeUsd.toFixed(2)}
                  {metricsQuery.data.monthlyProjection.billedUsd === null
                    ? ' | Billed (30d monthlyized): N/A'
                    : ` | Billed (30d monthlyized): $${metricsQuery.data.monthlyProjection.billedUsd.toFixed(2)}`}
                  {metricsQuery.data.monthlyProjection.deltaUsd === null
                    ? ''
                    : ` | Gap: $${metricsQuery.data.monthlyProjection.deltaUsd.toFixed(2)}`}
                </p>
              </div>
            </div>
          )}

          {tracesQuery.data && tracesQuery.data.runs.length > 0 && (
            <div className="space-y-1">
              {tracesQuery.data.runs.slice(0, 2).map((run) => (
                <div key={run.runId} className="space-y-1">
                  <a
                    href={resolveInternalTraceHref(run.traceUrl, run.traceId)}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded border border-border px-2 py-1.5 text-sm text-accent hover:bg-border/30"
                  >
                    {run.branch} ({run.trigger})
                  </a>
                  {resolveExternalTraceHref(run.externalTraceUrl) && (
                    <a
                      href={resolveExternalTraceHref(run.externalTraceUrl) || undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="block px-2 text-xs text-muted hover:text-foreground hover:underline"
                    >
                      View this run in LangSmith
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

function NoContextIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.25 6.75h1.5v7.5h-1.5zM11.25 16.5h1.5V18h-1.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3.75a8.25 8.25 0 100 16.5 8.25 8.25 0 000-16.5z" />
    </svg>
  );
}
