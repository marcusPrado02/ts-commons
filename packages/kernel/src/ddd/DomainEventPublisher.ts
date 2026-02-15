import type { DomainEvent } from './DomainEvent';

/**
 * Port for publishing domain events.
 * Implementations handle actual event dispatching.
 */
export interface DomainEventPublisher {
  publish(events: DomainEvent[]): Promise<void>;
  publishOne(event: DomainEvent): Promise<void>;
}
