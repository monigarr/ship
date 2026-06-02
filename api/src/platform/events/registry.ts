import { z } from 'zod';

export const documentCreatedSchema = z.object({
  type: z.literal('document.created'),
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  document_type: z.string(),
  title: z.string(),
  created_at: z.string(),
});

export type PlatformEvent =
  | z.infer<typeof documentCreatedSchema>
  | { type: string; [key: string]: unknown };

export const EVENT_TYPES = [
  'document.created',
  'document.updated',
  'document.deleted',
  'issue.created',
  'issue.assigned',
  'issue.status_changed',
  'sprint.started',
  'sprint.completed',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export function validateEventPayload(eventType: string, payload: unknown): PlatformEvent {
  if (eventType === 'document.created') {
    const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    return documentCreatedSchema.parse({ type: 'document.created', ...record });
  }
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  return { type: eventType, ...record };
}
