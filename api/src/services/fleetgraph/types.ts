export type FleetGraphTrigger = 'on_demand' | 'proactive_webhook' | 'proactive_poll';

export type FleetGraphBranch =
  | 'no_action'
  | 'execution_risk'
  | 'planning_risk'
  | 'evidence_risk'
  | 'compliance_risk';

export interface FleetGraphSignal {
  type: FleetGraphBranch;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  title: string;
  summary: string;
  entityType: 'issue' | 'project' | 'sprint' | 'weekly_plan' | 'weekly_retro' | 'workspace';
  entityId: string | null;
  evidence: string[];
  requiresHitl: boolean;
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
