export interface EventEnvelope<T = unknown> {
  readonly eventId: string;
  readonly eventType: string;
  readonly eventVersion: string;
  readonly timestamp: string;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly tenantId?: string;
  readonly payload: T;
  readonly metadata?: Record<string, unknown>;
}
