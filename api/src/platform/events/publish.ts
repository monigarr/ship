import { getPlatformEventBus } from './bus.js';
import type { PlatformEvent } from './registry.js';

export async function publishPlatformEvent(event: PlatformEvent): Promise<void> {
  const bus = getPlatformEventBus();
  await bus.publish(event);
}

export async function publishDocumentCreated(input: {
  id: string;
  workspace_id: string;
  document_type: string;
  title: string;
  created_at: string;
}): Promise<void> {
  await publishPlatformEvent({
    type: 'document.created',
    id: input.id,
    workspace_id: input.workspace_id,
    document_type: input.document_type,
    title: input.title,
    created_at: input.created_at,
  });
}

export async function publishDocumentUpdated(input: {
  id: string;
  workspace_id: string;
  title: string;
  updated_at: string;
}): Promise<void> {
  await publishPlatformEvent({
    type: 'document.updated',
    id: input.id,
    workspace_id: input.workspace_id,
    title: input.title,
    updated_at: input.updated_at,
  });
}

export async function publishDocumentDeleted(input: {
  id: string;
  workspace_id: string;
  deleted_at: string;
}): Promise<void> {
  await publishPlatformEvent({
    type: 'document.deleted',
    id: input.id,
    workspace_id: input.workspace_id,
    deleted_at: input.deleted_at,
  });
}

export async function publishIssueCreated(input: {
  id: string;
  workspace_id: string;
  title: string;
  created_at: string;
}): Promise<void> {
  await publishPlatformEvent({
    type: 'issue.created',
    id: input.id,
    workspace_id: input.workspace_id,
    title: input.title,
    created_at: input.created_at,
  });
}

export async function publishIssueAssigned(input: {
  id: string;
  workspace_id: string;
  assignee_id: string;
  assigned_at: string;
}): Promise<void> {
  await publishPlatformEvent({
    type: 'issue.assigned',
    id: input.id,
    workspace_id: input.workspace_id,
    assignee_id: input.assignee_id,
    assigned_at: input.assigned_at,
  });
}

export async function publishIssueStatusChanged(input: {
  id: string;
  workspace_id: string;
  from_state: string;
  to_state: string;
  changed_at: string;
}): Promise<void> {
  await publishPlatformEvent({
    type: 'issue.status_changed',
    id: input.id,
    workspace_id: input.workspace_id,
    from_state: input.from_state,
    to_state: input.to_state,
    changed_at: input.changed_at,
  });
}

export async function publishSprintStarted(input: {
  id: string;
  workspace_id: string;
  title: string;
  started_at: string;
}): Promise<void> {
  await publishPlatformEvent({
    type: 'sprint.started',
    id: input.id,
    workspace_id: input.workspace_id,
    title: input.title,
    started_at: input.started_at,
  });
}

export async function publishSprintCompleted(input: {
  id: string;
  workspace_id: string;
  title: string;
  completed_at: string;
}): Promise<void> {
  await publishPlatformEvent({
    type: 'sprint.completed',
    id: input.id,
    workspace_id: input.workspace_id,
    title: input.title,
    completed_at: input.completed_at,
  });
}
