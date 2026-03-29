/**
 * Integration tests: EventPublisher → FanOutBroker (Kafka stand-in) → EventHandler → Repository
 *
 * Exercises the full event-driven pipeline in-process:
 *  1. An EventPublisher posts an EventEnvelope to a FanOutBroker
 *  2. The broker dispatches to registered EventHandlers
 *  3. Each handler writes the result to an in-memory repository
 *
 * No real Kafka broker is required — FanOutBroker provides the same pub/sub semantics
 * and is the recommended in-process stand-in for unit/integration testing.
 */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/require-await */
import { describe, it, expect, beforeEach } from 'vitest';
import type { EventEnvelope } from './envelope/EventEnvelope';
import type { EventHandler } from './consumer/EventConsumer';
import { FanOutBroker } from './pubsub/FanOutBroker';

// ── Domain types used only in tests ──────────────────────────────────────────

interface OrderCreatedPayload {
  orderId: string;
  customerId: string;
  total: number;
}

interface OrderRecord {
  orderId: string;
  customerId: string;
  total: number;
  processedAt: Date;
}

// ── In-memory repository ──────────────────────────────────────────────────────

class InMemoryOrderRepository {
  private readonly store = new Map<string, OrderRecord>();

  save(record: OrderRecord): void {
    this.store.set(record.orderId, record);
  }

  findById(orderId: string): OrderRecord | undefined {
    return this.store.get(orderId);
  }

  size(): number {
    return this.store.size;
  }

  all(): OrderRecord[] {
    return [...this.store.values()];
  }
}

// ── Event handler that persists to the repository ─────────────────────────────

class OrderCreatedHandler implements EventHandler<OrderCreatedPayload> {
  public handledCount = 0;

  constructor(private readonly repo: InMemoryOrderRepository) {}

  async handle(envelope: EventEnvelope<OrderCreatedPayload>): Promise<void> {
    this.handledCount++;
    this.repo.save({
      orderId: envelope.payload.orderId,
      customerId: envelope.payload.customerId,
      total: envelope.payload.total,
      processedAt: new Date(envelope.timestamp),
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeOrderEnvelope(
  orderId: string,
  overrides?: Partial<OrderCreatedPayload>,
): EventEnvelope<OrderCreatedPayload> {
  return {
    eventId: `evt-${orderId}`,
    eventType: 'order.created',
    eventVersion: '1.0',
    timestamp: new Date().toISOString(),
    payload: {
      orderId,
      customerId: 'customer-1',
      total: 99.9,
      ...overrides,
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Event pipeline integration: publisher → broker → handler → repository', () => {
  let broker: FanOutBroker<OrderCreatedPayload>;
  let repo: InMemoryOrderRepository;
  let handler: OrderCreatedHandler;

  beforeEach(() => {
    broker = new FanOutBroker<OrderCreatedPayload>();
    repo = new InMemoryOrderRepository();
    handler = new OrderCreatedHandler(repo);
    broker.addSubscriber('order-handler', (env) => handler.handle(env));
  });

  it('published event reaches the handler', async () => {
    await broker.publish(makeOrderEnvelope('ORD-001'));
    expect(handler.handledCount).toBe(1);
  });

  it('handler persists event payload to repository', async () => {
    await broker.publish(makeOrderEnvelope('ORD-002', { total: 149.5 }));
    const record = repo.findById('ORD-002');
    expect(record).toBeDefined();
    expect(record?.total).toBe(149.5);
    expect(record?.customerId).toBe('customer-1');
  });

  it('repository reflects the correct orderId', async () => {
    await broker.publish(makeOrderEnvelope('ORD-003'));
    expect(repo.findById('ORD-003')).toBeDefined();
    expect(repo.findById('ORD-999')).toBeUndefined();
  });

  it('processedAt is populated from envelope timestamp', async () => {
    const timestamp = '2026-01-15T10:00:00.000Z';
    const envelope = { ...makeOrderEnvelope('ORD-004'), timestamp };
    await broker.publish(envelope);
    const record = repo.findById('ORD-004');
    expect(record?.processedAt.toISOString()).toBe(timestamp);
  });

  it('multiple events result in multiple repository entries', async () => {
    await broker.publish(makeOrderEnvelope('ORD-010'));
    await broker.publish(makeOrderEnvelope('ORD-011'));
    await broker.publish(makeOrderEnvelope('ORD-012'));
    expect(repo.size()).toBe(3);
  });

  it('second handler also receives the event (fan-out)', async () => {
    const repo2 = new InMemoryOrderRepository();
    const handler2 = new OrderCreatedHandler(repo2);
    broker.addSubscriber('audit-handler', (env) => handler2.handle(env));

    await broker.publish(makeOrderEnvelope('ORD-020'));
    expect(handler.handledCount).toBe(1);
    expect(handler2.handledCount).toBe(1);
    expect(repo2.findById('ORD-020')).toBeDefined();
  });

  it('idempotent handler: same event twice overwrites (last write wins)', async () => {
    const env1 = {
      ...makeOrderEnvelope('ORD-030'),
      payload: { orderId: 'ORD-030', customerId: 'c1', total: 10 },
    };
    const env2 = {
      ...makeOrderEnvelope('ORD-030'),
      payload: { orderId: 'ORD-030', customerId: 'c1', total: 20 },
    };
    await broker.publish(env1);
    await broker.publish(env2);
    expect(handler.handledCount).toBe(2);
    expect(repo.size()).toBe(1); // same orderId → overwrites
    expect(repo.findById('ORD-030')?.total).toBe(20);
  });

  it('unsubscribed handler no longer receives events', async () => {
    const unsubscribe = broker.addSubscriber('temp-handler', (env) => handler.handle(env));
    unsubscribe();
    await broker.publish(makeOrderEnvelope('ORD-040'));
    // original subscriber still active, temp one was removed
    expect(handler.handledCount).toBe(1); // only from the original subscription
  });

  it('handler receives correlationId when set on envelope', async () => {
    const correlationIds: Array<string | undefined> = [];
    broker.addSubscriber('correlating-handler', async (env) => {
      correlationIds.push(env.correlationId);
    });
    const envelope = { ...makeOrderEnvelope('ORD-050'), correlationId: 'req-xyz' };
    await broker.publish(envelope);
    expect(correlationIds).toContain('req-xyz');
  });

  it('empty broker publish completes without error', async () => {
    const emptyBroker = new FanOutBroker<OrderCreatedPayload>();
    await expect(emptyBroker.publish(makeOrderEnvelope('ORD-999'))).resolves.toBeUndefined();
  });

  it('publishTo delivers only to selected subscriber', async () => {
    const repo2 = new InMemoryOrderRepository();
    const handler2 = new OrderCreatedHandler(repo2);
    broker.addSubscriber('selective-handler', (env) => handler2.handle(env));

    await broker.publishTo(makeOrderEnvelope('ORD-060'), ['selective-handler']);
    expect(handler.handledCount).toBe(0); // original handler NOT called
    expect(handler2.handledCount).toBe(1); // selective handler called
  });
});
