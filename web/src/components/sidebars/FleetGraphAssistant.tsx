import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { getFleetGraphSeverityTone, resolveInternalTraceHref } from '@/lib/fleetgraphVisuals';

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
  traceId?: string;
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
  contextLabel?: string;
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
        <p className="text-xs font-medium">{signal.title}</p>
        <span className="text-[10px] uppercase tracking-wide opacity-80">{signal.severity}</span>
      </div>
      <p className="text-[11px] text-foreground/80 mt-0.5">{signal.summary}</p>
      <p className="text-[10px] text-muted mt-1">
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
            className="text-[10px] text-accent hover:underline"
          >
            {expanded ? 'Hide evidence' : `Show evidence (${signal.evidence.length})`}
          </button>
          {expanded && (
            <ul className="mt-1 space-y-0.5 list-disc list-inside text-[10px] text-muted">
              {signal.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {signal.notificationDrafts && signal.notificationDrafts.length > 0 && (
        <div className="mt-1.5 rounded border border-border/60 bg-background/40 px-1.5 py-1">
          <p className="text-[10px] font-medium text-muted uppercase tracking-wide">Suggested notify</p>
          <ul className="mt-0.5 space-y-0.5 text-[10px] text-muted">
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
        <p className="text-xs font-medium text-orange-300">Human approval required</p>
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] text-muted hover:text-foreground"
        >
          Close
        </button>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wide text-muted">Proposed action</p>
        <p className="text-xs text-foreground">
          {proposedActionLabel(target.signalType, target.title)}
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wide text-muted">Rationale</p>
        <p className="text-[11px] text-foreground/90">{target.summary}</p>
        {target.runSummary && (
          <p className="text-[11px] text-muted">{target.runSummary}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 text-[10px]">
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
          <p className="text-[10px] uppercase tracking-wide text-muted">Supporting evidence</p>
          <ul className="space-y-0.5 list-disc list-inside text-[10px] text-muted">
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
        className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent resize-none"
      />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onApprove}
          disabled={isPending}
          className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-500 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={isPending}
          className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-500 disabled:opacity-50"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={onRequestChanges}
          disabled={isPending}
          className="rounded bg-orange-600 px-2 py-1 text-xs text-white hover:bg-orange-500 disabled:opacity-50"
        >
          Request changes
        </button>
        <button
          type="button"
          onClick={onSnooze}
          disabled={isPending}
          className="rounded bg-yellow-600 px-2 py-1 text-xs text-white hover:bg-yellow-500 disabled:opacity-50"
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
}: FleetGraphAssistantProps) {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activeHitl, setActiveHitl] = useState<HitlTarget | null>(null);
  const [hitlNote, setHitlNote] = useState('');
  const [decisionBanner, setDecisionBanner] = useState<string | null>(null);

  const findingsQueryKey = ['fleetgraph-findings', documentId] as const;

  const findingsQuery = useQuery<FindingsResponse>({
    queryKey: findingsQueryKey,
    queryFn: async () => {
      const res = await apiGet(`/api/fleetgraph/findings?entity_id=${encodeURIComponent(documentId)}`);
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
    const findings = findingsQuery.data?.findings ?? [];
    return findings.filter(
      (finding) => finding.entityId === documentId || finding.entityId === null
    );
  }, [findingsQuery.data?.findings, documentId]);

  const quickPrompts = QUICK_PROMPTS[documentType] ?? QUICK_PROMPTS.issue;

  const invalidateFleetGraphQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: findingsQueryKey });
    queryClient.invalidateQueries({ queryKey: ['fleetgraph-metrics'] });
    queryClient.invalidateQueries({ queryKey: ['fleetgraph-traces'] });
  }, [queryClient, findingsQueryKey]);

  const runMutation = useMutation({
    mutationFn: async (promptText: string): Promise<FleetGraphRunResponse> => {
      const res = await apiPost('/api/fleetgraph/run', {
        document_id: documentId,
        document_type: documentType,
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
          entityType: pendingFinding.signal.entityType ?? documentType,
          entityId: pendingFinding.signal.entityId ?? documentId,
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
      if (!trimmed || runMutation.isPending) {
        return;
      }
      runMutation.mutate(trimmed);
    },
    [runMutation]
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

  const contextDisplay = contextLabel?.trim() || documentId.slice(0, 8);

  return (
    <div className="rounded-lg border border-border bg-background/80 p-3 space-y-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold tracking-wide text-muted uppercase">FleetGraph</h4>
          <span className="text-[10px] text-muted uppercase">On-demand</span>
        </div>
        <p className="text-[11px] text-muted">
          Scoped to {formatEntityType(documentType)}:{' '}
          <span className="text-foreground">{contextDisplay}</span>
        </p>
      </div>

      {decisionBanner && (
        <div className="rounded border border-green-500/30 bg-green-500/10 px-2 py-1 text-[11px] text-green-300">
          {decisionBanner}
        </div>
      )}

      <div className="space-y-2 max-h-56 overflow-y-auto rounded border border-border/60 bg-border/10 p-2">
        {chatMessages.length === 0 && !runMutation.isPending && (
          <p className="text-[11px] text-muted">
            Ask about this {formatEntityType(documentType)} — FleetGraph answers from records you
            can access in this view.
          </p>
        )}

        {chatMessages.map((message, index) =>
          message.role === 'user' ? (
            <div key={`user-${index}`} className="flex justify-end">
              <div className="max-w-[90%] rounded bg-accent/20 px-2 py-1 text-[11px] text-foreground">
                {message.text}
              </div>
            </div>
          ) : (
            <div key={`assistant-${index}`} className="space-y-1.5">
              <div className="rounded border border-border bg-background/70 px-2 py-1.5">
                <p className="text-xs text-foreground">{message.summary}</p>
                <p className="text-[10px] text-muted mt-1">
                  Branch: {message.run.branch} | Latency: {message.run.latencyMs}ms
                </p>
                <a
                  href={resolveInternalTraceHref(message.run.traceUrl, message.run.traceId)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-accent hover:underline"
                >
                  Open trace details
                </a>
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
        <p className="text-[11px] text-red-400">
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
            disabled={runMutation.isPending}
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
          placeholder={`Ask about this ${formatEntityType(documentType)}...`}
          rows={2}
          disabled={runMutation.isPending}
          className="flex-1 rounded border border-border bg-border/30 px-2 py-1.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent resize-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => submitPrompt(prompt)}
          disabled={runMutation.isPending || !prompt.trim()}
          className="self-end rounded bg-accent px-2 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
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
          <p className="text-[11px] font-medium text-muted uppercase tracking-wide">
            Findings for this view
          </p>
          <span className="rounded bg-border px-1.5 py-0.5 text-[10px] text-muted">
            {scopedFindings.length}
          </span>
        </div>

        {findingsQuery.isLoading && <p className="text-xs text-muted">Loading findings...</p>}
        {!findingsQuery.isLoading && scopedFindings.length === 0 && (
          <p className="text-xs text-muted">No open FleetGraph findings for this view.</p>
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
              <p className="text-xs text-foreground font-medium">{finding.title}</p>
              <span className={`text-[10px] uppercase ${severityClass(finding.severity)} px-1 rounded`}>
                {finding.severity}
              </span>
            </div>
            <p className="text-[11px] text-muted">{finding.summary}</p>
            {finding.evidence.length > 0 && (
              <ul className="space-y-0.5 list-disc list-inside text-[10px] text-muted">
                {finding.evidence.slice(0, 3).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {finding.notificationDrafts && finding.notificationDrafts.length > 0 && (
              <div className="rounded border border-border/50 bg-background/30 px-1.5 py-1">
                <p className="text-[10px] font-medium text-muted uppercase">Suggested notify</p>
                <ul className="mt-0.5 space-y-0.5 text-[10px] text-muted">
                  {finding.notificationDrafts.slice(0, 2).map((draft) => (
                    <li key={`${finding.id}-${draft.role}`}>
                      {draft.role.replace(/_/g, ' ')}: {draft.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {finding.snoozedUntil && (
              <p className="text-[10px] text-yellow-400">Snoozed until {finding.snoozedUntil}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {finding.status === 'pending_approval' && finding.hitlRequestId && (
                <button
                  type="button"
                  onClick={() => openFindingHitl(finding)}
                  className="rounded bg-orange-600 px-2 py-0.5 text-[10px] text-white hover:bg-orange-500"
                >
                  Review
                </button>
              )}
              {finding.status !== 'pending_approval' && (
                <button
                  type="button"
                  onClick={() => snoozeMutation.mutate({ findingId: finding.id })}
                  disabled={snoozeMutation.isPending}
                  className="rounded border border-yellow-500/40 px-2 py-0.5 text-[10px] text-yellow-300 hover:bg-yellow-500/10 disabled:opacity-50"
                >
                  Snooze 24h
                </button>
              )}
              <a
                href={resolveInternalTraceHref(finding.traceUrl, finding.traceId)}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-accent hover:underline self-center"
              >
                Trace details
              </a>
            </div>
          </div>
        ))}
      </div>

      <details className="border-t border-border pt-2">
        <summary className="cursor-pointer text-[11px] font-medium text-muted uppercase tracking-wide">
          Diagnostics
        </summary>
        <div className="mt-2 space-y-2">
          <a href="/fleetgraph/traces" className="inline-block text-[11px] text-accent hover:underline">
            Open full trace index
          </a>
          {metricsQuery.data && (
            <div className="space-y-1">
              <p className="text-[11px] text-muted">
                Runs: {metricsQuery.data.runCount} | Avg latency:{' '}
                {Math.round(metricsQuery.data.avgLatencyMs)}ms
              </p>
              <p className="text-[11px] text-muted">
                Tokens: {metricsQuery.data.totalTokenEstimate.toLocaleString()} | Spend est: $
                {metricsQuery.data.totalCostEstimateUsd.toFixed(3)}
              </p>
              <p className="text-[11px] text-muted">
                Monthly projection: ${metricsQuery.data.monthlyProjectionUsd.users100.toFixed(0)} / $
                {metricsQuery.data.monthlyProjectionUsd.users1000.toFixed(0)} / $
                {metricsQuery.data.monthlyProjectionUsd.users10000.toFixed(0)}
              </p>
            </div>
          )}

          {tracesQuery.data && tracesQuery.data.runs.length > 0 && (
            <div className="space-y-1">
              {tracesQuery.data.runs.slice(0, 2).map((run) => (
                <a
                  key={run.runId}
                  href={resolveInternalTraceHref(run.traceUrl, run.traceId)}
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
      </details>
    </div>
  );
}
