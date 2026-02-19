/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EventEnvelope, EventPublisherPort } from '@acme/messaging';
import type { OutboxMessage } from './outbox/OutboxStorePort';
import type { InboxMessage } from './inbox/InboxStorePort';
import { InMemoryOutboxStore } from './outbox/InMemoryOutboxStore';
import { InMemoryInboxStore } from './inbox/InMemoryInboxStore';
import { OutboxRelayMetrics } from './relay/OutboxRelayMetrics';
import { OutboxRelay } from './relay/OutboxRelay';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeEnvelope = (eventId = 'evt-1'): EventEnvelope => ({
  eventId,
  eventType: 'TestEvent',
  eventVersion: '1.0',
  timestamp: new Date().toISOString(),
  payload: { data: 'value' },
});

const makeOutboxMessage = (overrides?: Partial<OutboxMessage>): OutboxMessage => ({
  id: 'msg-1',
  eventEnvelope: makeEnvelope(),
  createdAt: new Date(),
  attempts: 0,
  ...overrides,
});

const makeInboxMessage = (overrides?: Partial<InboxMessage>): InboxMessage => ({
  id: 'inbox-1',
  eventEnvelope: makeEnvelope(),
  receivedAt: new Date(),
  ...overrides,
});

const makePublisher = (): EventPublisherPort => ({
  publish: vi.fn().mockResolvedValue(undefined),
  publishBatch: vi.fn().mockResolvedValue(undefined),
});

// ─── InMemoryOutboxStore ───────────────────────────────────────────────────────

describe('InMemoryOutboxStore', () => {
  let store: InMemoryOutboxStore;

  beforeEach(() => {
    store = new InMemoryOutboxStore();
  });

  it('save stores a message that getUnpublished subsequently returns', async () => {
    const msg = makeOutboxMessage();
    await store.save(msg);
    const unpublished = await store.getUnpublished(10);
    expect(unpublished).toHaveLength(1);
    expect(unpublished[0]?.id).toBe('msg-1');
  });

  it('markAsPublished sets publishedAt and excludes the message from getUnpublished', async () => {
    const msg = makeOutboxMessage();
    await store.save(msg);
    await store.markAsPublished(msg.id);
    const unpublished = await store.getUnpublished(10);
    expect(unpublished).toHaveLength(0);
    const all = store.getAll();
    expect(all[0]?.publishedAt).toBeInstanceOf(Date);
  });

  it('markAsFailed increments attempts and stores the error string', async () => {
    const msg = makeOutboxMessage({ attempts: 0 });
    await store.save(msg);
    await store.markAsFailed(msg.id, 'connection refused');
    const all = store.getAll();
    expect(all[0]?.attempts).toBe(1);
    expect(all[0]?.error).toBe('connection refused');
  });

  it('getUnpublished respects the limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      await store.save(makeOutboxMessage({ id: `msg-${i}` }));
    }
    const result = await store.getUnpublished(3);
    expect(result).toHaveLength(3);
  });

  it('getUnpublished excludes already-published messages', async () => {
    await store.save(makeOutboxMessage({ id: 'a' }));
    await store.save(makeOutboxMessage({ id: 'b' }));
    await store.markAsPublished('a');
    const unpublished = await store.getUnpublished(10);
    expect(unpublished).toHaveLength(1);
    expect(unpublished[0]?.id).toBe('b');
  });
});

// ─── InMemoryInboxStore ────────────────────────────────────────────────────────

describe('InMemoryInboxStore', () => {
  let store: InMemoryInboxStore;

  beforeEach(() => {
    store = new InMemoryInboxStore();
  });

  it('isDuplicate returns false for an eventId that has not been saved', async () => {
    const result = await store.isDuplicate('unknown-evt');
    expect(result).toBe(false);
  });

  it('isDuplicate returns true after the message is saved (eventId is indexed on save)', async () => {
    const msg = makeInboxMessage({ id: 'i-1' });
    await store.save(msg);
    const result = await store.isDuplicate(msg.eventEnvelope.eventId);
    expect(result).toBe(true);
  });

  it('markAsProcessed sets processedAt on the stored message', async () => {
    const msg = makeInboxMessage();
    await store.save(msg);
    await store.markAsProcessed(msg.id);
    const all = store.getAll();
    expect(all[0]?.processedAt).toBeInstanceOf(Date);
  });

  it('save stores the message retrievable via getAll', async () => {
    const msg = makeInboxMessage({ id: 'i-2' });
    await store.save(msg);
    expect(store.size()).toBe(1);
    expect(store.getAll()[0]?.id).toBe('i-2');
  });
});

// ─── OutboxRelayMetrics ────────────────────────────────────────────────────────

describe('OutboxRelayMetrics', () => {
  let metrics: OutboxRelayMetrics;

  beforeEach(() => {
    metrics = new OutboxRelayMetrics();
  });

  it('starts with all counters at zero', () => {
    expect(metrics.published).toBe(0);
    expect(metrics.failed).toBe(0);
    expect(metrics.skipped).toBe(0);
  });

  it('recordPublished increments the published counter', () => {
    metrics.recordPublished();
    metrics.recordPublished();
    expect(metrics.published).toBe(2);
  });

  it('recordFailed increments the failed counter', () => {
    metrics.recordFailed();
    expect(metrics.failed).toBe(1);
  });

  it('snapshot captures the current state and reset zeroes all counters', () => {
    metrics.recordPublished();
    metrics.recordFailed();
    metrics.recordSkipped();
    const snap = metrics.snapshot();
    expect(snap).toEqual({ published: 1, failed: 1, skipped: 1 });
    metrics.reset();
    expect(metrics.published).toBe(0);
    expect(metrics.failed).toBe(0);
    expect(metrics.skipped).toBe(0);
  });
});

// ─── OutboxRelay ───────────────────────────────────────────────────────────────

describe('OutboxRelay', () => {
  let outboxStore: InMemoryOutboxStore;
  let publisher: EventPublisherPort;
  let metrics: OutboxRelayMetrics;
  let relay: OutboxRelay;

  beforeEach(() => {
    outboxStore = new InMemoryOutboxStore();
    publisher = makePublisher();
    metrics = new OutboxRelayMetrics();
    relay = new OutboxRelay(outboxStore, publisher, { maxAttempts: 3 }, metrics);
  });

  it('runOnce publishes a pending message and marks it as published', async () => {
    await outboxStore.save(makeOutboxMessage());
    await relay.runOnce();
    expect(publisher.publish).toHaveBeenCalledTimes(1);
    const all = outboxStore.getAll();
    expect(all[0]?.publishedAt).toBeInstanceOf(Date);
  });

  it('runOnce calls markAsFailed when the publisher throws', async () => {
    (publisher.publish as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('broker down'));
    await outboxStore.save(makeOutboxMessage());
    await relay.runOnce();
    const all = outboxStore.getAll();
    expect(all[0]?.error).toBe('broker down');
    expect(all[0]?.attempts).toBe(1);
  });

  it('runOnce skips messages that have exceeded maxAttempts and marks them as DLQ', async () => {
    // attempts === maxAttempts (3), so should be skipped/DLQ'd without publishing
    const msg = makeOutboxMessage({ attempts: 3, id: 'dlq-msg' });
    await outboxStore.save(msg);
    await relay.runOnce();
    expect(publisher.publish).not.toHaveBeenCalled();
    expect(metrics.skipped).toBe(1);
    const all = outboxStore.getAll();
    expect(all[0]?.error).toBe('max attempts exceeded');
  });

  it('runOnce updates metrics with published count on success', async () => {
    await outboxStore.save(makeOutboxMessage({ id: 'm-1' }));
    await outboxStore.save(makeOutboxMessage({ id: 'm-2' }));
    await relay.runOnce();
    expect(metrics.published).toBe(2);
    expect(metrics.failed).toBe(0);
  });

  it('runOnce on an empty store is a no-op', async () => {
    await relay.runOnce();
    expect(publisher.publish).not.toHaveBeenCalled();
    expect(metrics.published).toBe(0);
  });

  it('isHealthy returns false after a run with publish failures', async () => {
    (publisher.publish as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('timeout'));
    await outboxStore.save(makeOutboxMessage());
    expect(relay.isHealthy()).toBe(true); // before any run
    await relay.runOnce();
    expect(relay.isHealthy()).toBe(false);
  });
});
