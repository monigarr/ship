export type FleetGraphTrigger = 'on_demand' | 'proactive_webhook' | 'proactive_poll';

export type FleetGraphBranch =
  | 'no_action'
  | 'execution_risk'
  | 'planning_risk'
  | 'evidence_risk'
  | 'hypothesis_risk'
  | 'compliance_risk'
  | 'accountability_risk';

export interface FleetGraphNotificationDraft {
  role: string;
  reason: string;
}

export interface FleetGraphSignal {
  type: FleetGraphBranch;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  title: string;
  summary: string;
  entityType: 'issue' | 'project' | 'sprint' | 'weekly_plan' | 'weekly_retro' | 'workspace' | 'user';
  entityId: string | null;
  evidence: string[];
  requiresHitl: boolean;
  notificationDrafts?: FleetGraphNotificationDraft[];
}

export interface FleetGraphContext {
  userId: string;
  workspaceId: string;
  documentId?: string;
  documentType?: string;
  prompt?: string;
}

export interface FleetGraphRunRecord {
  runId: string;
  traceId: string;
  traceUrl: string;
  externalTraceUrl: string | null;
  trigger: FleetGraphTrigger;
  branch: FleetGraphBranch;
  startedAt: string;
  completedAt: string;
  latencyMs: number;
  tokenEstimate: number;
  costEstimateUsd: number;
}

export interface FleetGraphRunResult {
  run: FleetGraphRunRecord;
  signals: FleetGraphSignal[];
  summary: string;
  findings: Array<{
    id: string;
    status: 'open' | 'snoozed' | 'resolved' | 'pending_approval' | 'rejected';
    signal: FleetGraphSignal;
  }>;
  hitlRequestId?: string;
}
