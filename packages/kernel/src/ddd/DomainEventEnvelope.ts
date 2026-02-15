import type { DomainEvent } from './DomainEvent';

/**
 * Envelope for domain events with metadata.
 */
export interface DomainEventEnvelope<T extends DomainEvent = DomainEvent> {
  readonly event: T;
  readonly eventId: string;
  readonly eventType: string;
  readonly occurredAt: Date;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly aggregateVersion: number;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly tenantId?: string;
  readonly metadata?: Record<string, unknown>;
}
