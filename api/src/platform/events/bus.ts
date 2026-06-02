import type { PlatformEvent } from './registry.js';

export interface IEventBus {
  publish(event: PlatformEvent): Promise<void>;
}

type EventHandler = (event: PlatformEvent) => void | Promise<void>;

export class InMemoryEventBus implements IEventBus {
  private handlers: EventHandler[] = [];

  subscribe(handler: EventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  async publish(event: PlatformEvent): Promise<void> {
    await Promise.all(this.handlers.map((handler) => handler(event)));
  }
}

let globalBus: InMemoryEventBus | null = null;

export function getPlatformEventBus(): InMemoryEventBus {
  if (!globalBus) {
    globalBus = new InMemoryEventBus();
  }
  return globalBus;
}

export function resetPlatformEventBusForTests(): void {
  globalBus = new InMemoryEventBus();
}
