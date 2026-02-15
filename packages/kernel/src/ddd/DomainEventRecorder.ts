import type { DomainEvent } from './DomainEvent';

/**
 * Simple in-memory domain event recorder.
 * Useful for collecting events during a transaction.
 */
export class DomainEventRecorder {
  private events: DomainEvent[] = [];

  record(event: DomainEvent): void {
    this.events.push(event);
  }

  recordMany(events: DomainEvent[]): void {
    this.events.push(...events);
  }

  getEvents(): readonly DomainEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
  }

  hasEvents(): boolean {
    return this.events.length > 0;
  }
}
