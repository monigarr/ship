/**
 * @version 0.1.0
 * @date 2026-05-25
 * @author Monica Peters <monica.peters@gfachallenger.gauntletai.com>
 *
 * Purpose: Execute approved FleetGraph HITL actions against Ship documents.
 *
 * Usage: Called from decideFleetGraphHitlRequest when decision is approved.
 *
 * Example:
 *   await executeApprovedHitlAction(workspaceId, userId, actionPayload);
 *
 * Dependencies: Postgres documents table, fleetgraph action_payload schema.
 *
 * Security/PHI: Scoped workspace updates only; audit fields in properties.
 * HIPAA: N/A — no PHI.
 * FHIR: N/A — not interoperability.
 * Accessibility: N/A — non-UI.
 * Performance: Single-row updates per action.
 * Stability: No-op on unknown action types; errors bubble to route handler.
 * Legal/compliance: Agent notes are labeled; no autonomous compliance pass.
 */

import { pool } from '../../db/client.js';
import type { FleetGraphBranch } from './types.js';

export interface HitlActionPayload {
  title?: string;
  summary?: string;
  entityType?: string;
  entityId?: string | null;
  severity?: string;
  confidence?: number;
  signalType?: FleetGraphBranch;
  actionType?: string;
}

export async function executeApprovedHitlAction(
  workspaceId: string,
  userId: string,
  payload: HitlActionPayload
): Promise<{ executed: boolean; actionType: string; detail: string }> {
  const signalType = payload.signalType ?? 'compliance_risk';
  const actionType = payload.actionType ?? defaultActionType(signalType);
  const entityId = payload.entityId;

  if (!entityId || payload.entityType === 'workspace') {
    return {
      executed: false,
      actionType,
      detail: 'No target entity for HITL execution.',
    };
  }

  switch (actionType) {
    case 'compliance_review_hold':
      await appendAgentNote(entityId, workspaceId, userId, {
        fleetgraph_compliance_status: 'agent_review_recorded',
        fleetgraph_hitl_approved_at: new Date().toISOString(),
        fleetgraph_hitl_approved_by: userId,
      });
      return {
        executed: true,
        actionType,
        detail: 'Recorded agent compliance review hold on target document.',
      };

    case 'escalate_issue_priority':
      if (payload.entityType !== 'issue') {
        return { executed: false, actionType, detail: 'Escalation requires an issue entity.' };
      }
      await pool.query(
        `UPDATE documents
         SET properties = COALESCE(properties, '{}'::jsonb) || $1::jsonb,
             updated_at = NOW()
         WHERE id = $2
           AND workspace_id = $3
           AND deleted_at IS NULL`,
        [
          JSON.stringify({
            priority: 'high',
            fleetgraph_escalated_at: new Date().toISOString(),
            fleetgraph_escalated_by: userId,
          }),
          entityId,
          workspaceId,
        ]
      );
      return {
        executed: true,
        actionType,
        detail: 'Issue priority escalated to high with FleetGraph audit metadata.',
      };

    case 'request_plan_review':
      await appendAgentNote(entityId, workspaceId, userId, {
        fleetgraph_plan_review_requested: true,
        fleetgraph_review_requested_at: new Date().toISOString(),
        fleetgraph_review_requested_by: userId,
      });
      return {
        executed: true,
        actionType,
        detail: 'Plan review request recorded on target document.',
      };

    default:
      await appendAgentNote(entityId, workspaceId, userId, {
        fleetgraph_hitl_action: actionType,
        fleetgraph_hitl_approved_at: new Date().toISOString(),
        fleetgraph_hitl_approved_by: userId,
      });
      return {
        executed: true,
        actionType,
        detail: 'Generic FleetGraph HITL approval note recorded.',
      };
  }
}

function defaultActionType(signalType: FleetGraphBranch): string {
  switch (signalType) {
    case 'compliance_risk':
      return 'compliance_review_hold';
    case 'execution_risk':
      return 'escalate_issue_priority';
    case 'planning_risk':
      return 'request_plan_review';
    default:
      return 'record_agent_note';
  }
}

async function appendAgentNote(
  documentId: string,
  workspaceId: string,
  userId: string,
  fields: Record<string, unknown>
): Promise<void> {
  await pool.query(
    `UPDATE documents
     SET properties = COALESCE(properties, '{}'::jsonb) || $1::jsonb,
         updated_at = NOW()
     WHERE id = $2
       AND workspace_id = $3
       AND deleted_at IS NULL`,
    [JSON.stringify(fields), documentId, workspaceId]
  );
}

export function buildHitlActionPayload(
  signal: {
    type: FleetGraphBranch;
    title: string;
    summary: string;
    entityType: string;
    entityId: string | null;
    severity: string;
    confidence: number;
  }
): HitlActionPayload {
  return {
    title: signal.title,
    summary: signal.summary,
    entityType: signal.entityType,
    entityId: signal.entityId,
    severity: signal.severity,
    confidence: signal.confidence,
    signalType: signal.type,
    actionType: defaultActionType(signal.type),
  };
}
