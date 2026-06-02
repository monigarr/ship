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
