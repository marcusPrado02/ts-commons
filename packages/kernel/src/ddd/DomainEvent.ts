import type { CorrelationId } from '../identity/CorrelationId';
import type { CausationId } from '../identity/CausationId';
import type { TenantId } from '../identity/TenantId';

/**
 * Base class for domain events.
 * Domain events represent something that happened in the domain.
 */
export abstract class DomainEvent {
  public readonly occurredAt: Date;
  public readonly eventId: string;
  public readonly eventType: string;

  // Context metadata
  public correlationId?: CorrelationId;
  public causationId?: CausationId;
  public tenantId?: TenantId;

  constructor() {
    this.occurredAt = new Date();
    this.eventId = crypto.randomUUID();
    this.eventType = this.constructor.name;
  }
}
