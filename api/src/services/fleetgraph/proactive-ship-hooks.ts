/**
 * @version 0.1.0
 * @date 2026-05-25
 * @author Monica Peters <monica.peters@gfachallenger.gauntletai.com>
 *
 * Purpose: Bridge Ship mutation routes to FleetGraph proactive webhook triggers.
 *
 * Usage: Call `emitFleetGraphShipEvent` or `emitFleetGraphDocumentMutation` after successful writes.
 *
 * Example:
 *   emitFleetGraphShipEvent(req, 'issue_updated', issueId, 'issue');
 *
 * Dependencies: `proactive.scheduleProactiveWebhookFromShipEvent`
 *
 * Security/PHI: Uses authenticated request workspace/user context only.
 * HIPAA: N/A — no PHI.
 * FHIR: N/A — not interoperability.
 * Accessibility: N/A — non-UI.
 * Performance: Fire-and-forget; debounced in proactive pipeline.
 * Stability: No-op when proactive mode disabled or document type is not high-signal.
 * Legal/compliance: N/A.
 */

import type { Request } from 'express';
import {
  isHighSignalWebhookDocument,
  scheduleProactiveWebhookFromShipEvent,
  type ProactiveWebhookEventType,
} from './proactive.js';

export type FleetGraphShipDocumentType =
  | 'issue'
  | 'weekly_plan'
  | 'weekly_retro'
  | 'weekly_review'
  | 'project'
  | 'standup'
  | 'sprint';

type FleetGraphRequestContext = Pick<Request, 'workspaceId' | 'userId'>;

export function emitFleetGraphShipEvent(
  req: FleetGraphRequestContext,
  eventType: ProactiveWebhookEventType,
  documentId: string,
  documentType: FleetGraphShipDocumentType
): void {
  if (!req.workspaceId || !req.userId) {
    return;
  }

  scheduleProactiveWebhookFromShipEvent(
    {
      workspaceId: req.workspaceId,
      userId: req.userId,
      documentId,
      documentType,
    },
    {
      eventType,
      documentId,
      documentType,
      eventId: `${eventType}:${documentId}:${Date.now()}`,
    }
  );
}

function resolveDocumentMutationEventType(
  documentType: string,
  contentUpdated: boolean
): ProactiveWebhookEventType | null {
  switch (documentType) {
    case 'issue':
      return 'issue_updated';
    case 'weekly_plan':
      return contentUpdated ? 'plan_submitted' : 'approval_changed';
    case 'weekly_retro':
      return contentUpdated ? 'retro_submitted' : 'approval_changed';
    case 'standup':
      return 'issue_updated';
    case 'sprint':
      return 'sprint_boundary';
    case 'weekly_review':
      return contentUpdated ? 'retro_submitted' : 'approval_changed';
    case 'project':
      return contentUpdated ? 'evidence_attached' : null;
    default:
      return null;
  }
}

export function emitFleetGraphDocumentMutation(
  req: FleetGraphRequestContext,
  documentId: string,
  documentType: string,
  options?: {
    eventType?: ProactiveWebhookEventType;
    contentUpdated?: boolean;
  }
): void {
  if (!isHighSignalWebhookDocument(documentType)) {
    return;
  }

  const eventType =
    options?.eventType ??
    resolveDocumentMutationEventType(documentType, options?.contentUpdated ?? false);

  if (!eventType) {
    return;
  }

  emitFleetGraphShipEvent(
    req,
    eventType,
    documentId,
    documentType as FleetGraphShipDocumentType
  );
}
