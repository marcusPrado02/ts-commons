import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DomainEvent } from '../src/ddd/DomainEvent';
import { CorrelationId, CausationId, TenantId } from '../src';

// Test implementation
class UserCreatedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
  ) {
    super();
  }
}

class OrderPlacedEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly amount: number,
  ) {
    super();
  }
}

describe('DomainEvent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('creation', () => {
    it('should create event with metadata', () => {
      const now = new Date('2026-02-15T10:00:00Z');
      vi.setSystemTime(now);

      const event = new UserCreatedEvent('user-123', 'test@example.com');

      expect(event.occurredAt).toEqual(now);
      expect(event.eventType).toBe('UserCreatedEvent');
      expect(event.eventId).toBeDefined();
      expect(typeof event.eventId).toBe('string');
    });

    it('should generate unique event IDs', () => {
      const event1 = new UserCreatedEvent('user-1', 'test1@example.com');
      const event2 = new UserCreatedEvent('user-2', 'test2@example.com');

      expect(event1.eventId).toBeDefined();
      expect(event2.eventId).toBeDefined();
      expect(event1.eventId).not.toBe(event2.eventId);
    });

    it('should include event-specific data', () => {
      const event = new UserCreatedEvent('user-123', 'john@example.com');

      expect(event.userId).toBe('user-123');
      expect(event.email).toBe('john@example.com');
    });
  });

  describe('eventType', () => {
    it('should derive event type from class name', () => {
      const userEvent = new UserCreatedEvent('user-1', 'test@example.com');
      const orderEvent = new OrderPlacedEvent('order-1', 100);

      expect(userEvent.eventType).toBe('UserCreatedEvent');
      expect(orderEvent.eventType).toBe('OrderPlacedEvent');
    });
  });

  describe('metadata fields', () => {
    it('should allow setting correlationId', () => {
      const event = new UserCreatedEvent('user-1', 'test@example.com');
      const correlationId = CorrelationId.fromString('corr-123');

      event.correlationId = correlationId;

      expect(event.correlationId).toBe(correlationId);
    });

    it('should allow setting causationId', () => {
      const event = new UserCreatedEvent('user-1', 'test@example.com');
      const causationId = CausationId.fromString('cause-456');

      event.causationId = causationId;

      expect(event.causationId).toBe(causationId);
    });

    it('should allow setting tenantId', () => {
      const event = new UserCreatedEvent('user-1', 'test@example.com');
      const tenantId = TenantId.create('tenant-789');

      event.tenantId = tenantId;

      expect(event.tenantId).toBe(tenantId);
    });

    it('should have optional metadata by default', () => {
      const event = new UserCreatedEvent('user-1', 'test@example.com');

      expect(event.correlationId).toBeUndefined();
      expect(event.causationId).toBeUndefined();
      expect(event.tenantId).toBeUndefined();
    });
  });
});
