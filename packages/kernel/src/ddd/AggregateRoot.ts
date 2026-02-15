import type { DomainEvent } from './DomainEvent';

/**
 * Base AggregateRoot for DDD aggregates.
 * Aggregates are consistency boundaries that record domain events.
 */
export abstract class AggregateRoot<TId> {
  private readonly _domainEvents: DomainEvent[] = [];
  protected _version = 0;

  constructor(protected readonly _id: TId) {}

  get id(): TId {
    return this._id;
  }

  get version(): number {
    return this._version;
  }

  /**
   * Get all recorded domain events (uncommitted).
   */
  getUncommittedEvents(): readonly DomainEvent[] {
    return [...this._domainEvents];
  }

  /**
   * Clear recorded events (typically after publishing).
   */
  clearEvents(): void {
    this._domainEvents.length = 0;
  }

  /**
   * Record a domain event.
   */
  protected record(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  /**
   * Mark events as committed and increment version.
   */
  markEventsAsCommitted(): void {
    this._version += this._domainEvents.length;
    this.clearEvents();
  }

  equals(other: AggregateRoot<TId>): boolean {
    if (!(other instanceof AggregateRoot)) {
      return false;
    }
    return this._id === other._id;
  }
}
