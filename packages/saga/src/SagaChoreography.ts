import type { ChoreographyEvent, ChoreographyHandler } from './types';

export class SagaChoreography {
  private readonly handlers = new Map<string, ChoreographyHandler[]>();

  on(eventType: string, handler: ChoreographyHandler): void {
    const existing = this.handlers.get(eventType) ?? [];
    this.handlers.set(eventType, [...existing, handler]);
  }

  off(eventType: string, handler: ChoreographyHandler): void {
    const existing = this.handlers.get(eventType) ?? [];
    this.handlers.set(
      eventType,
      existing.filter((h) => h !== handler),
    );
  }

  async emit(event: ChoreographyEvent): Promise<void> {
    const handlerList = this.handlers.get(event.type) ?? [];
    for (const handler of handlerList) {
      await handler(event);
    }
  }

  getHandlerCount(eventType: string): number {
    return this.handlers.get(eventType)?.length ?? 0;
  }

  clearHandlers(eventType?: string): void {
    if (eventType !== undefined) {
      this.handlers.delete(eventType);
    } else {
      this.handlers.clear();
    }
  }
}
