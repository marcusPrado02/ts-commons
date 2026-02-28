/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { DomainEvent } from '@acme/kernel';
import { InMemoryEventStore } from '../index';
import { EventReplayer, ReplayMonitor } from './index';

// ─── Test events ──────────────────────────────────────────────────────────────

class OrderCreated extends DomainEvent {
  constructor(readonly orderId: string) {
    super();
  }
}

class OrderShipped extends DomainEvent {
  constructor(readonly orderId: string) {
    super();
  }
}

class OrderCancelled extends DomainEvent {
  constructor(readonly orderId: string) {
    super();
  }
}

async function seedStore(streamId = 'order-1'): Promise<InMemoryEventStore> {
  const store = new InMemoryEventStore();
  await store.append(
    streamId,
    [new OrderCreated('O1'), new OrderShipped('O1'), new OrderCancelled('O1')],
    0,
  );
  return store;
}

// ─── EventReplayer ────────────────────────────────────────────────────────────

describe('EventReplayer', () => {
  it('replays all events on a stream', async () => {
    const store = await seedStore();
    const replayer = new EventReplayer(store);
    const received: DomainEvent[] = [];
    await replayer.replay('order-1', (e) => received.push(e));
    expect(received).toHaveLength(3);
    expect(received[0]).toBeInstanceOf(OrderCreated);
    expect(received[2]).toBeInstanceOf(OrderCancelled);
  });

  it('returns accurate ReplayStats', async () => {
    const store = await seedStore();
    const replayer = new EventReplayer(store);
    const stats = await replayer.replay('order-1', () => undefined);
    expect(stats.streamId).toBe('order-1');
    expect(stats.totalEvents).toBe(3);
    expect(stats.eventsProcessed).toBe(3);
    expect(stats.eventsSkipped).toBe(0);
    expect(stats.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('fromVersion skips early events', async () => {
    const store = await seedStore();
    const replayer = new EventReplayer(store);
    const received: DomainEvent[] = [];
    await replayer.replay('order-1', (e) => received.push(e), { fromVersion: 1 });
    expect(received).toHaveLength(2);
    expect(received[0]).toBeInstanceOf(OrderShipped);
  });

  it('toVersion stops replay at given version', async () => {
    const store = await seedStore();
    const replayer = new EventReplayer(store);
    const received: DomainEvent[] = [];
    await replayer.replay('order-1', (e) => received.push(e), { toVersion: 2 });
    expect(received).toHaveLength(2);
    expect(received[1]).toBeInstanceOf(OrderShipped);
  });

  describe('replayPointInTime()', () => {
    it('filters events after the given timestamp', async () => {
      const store = new InMemoryEventStore();
      const past = new OrderCreated('O2');
      const future = new OrderShipped('O2');
      // Manually set occurredAt to known values
      Object.defineProperty(past, 'occurredAt', { value: new Date('2024-01-01') });
      Object.defineProperty(future, 'occurredAt', { value: new Date('2024-12-31') });
      await store.append('order-2', [past, future], 0);

      const replayer = new EventReplayer(store);
      const received: DomainEvent[] = [];
      await replayer.replayPointInTime('order-2', new Date('2024-06-01'), (e) => received.push(e));
      expect(received).toHaveLength(1);
      expect(received[0]).toBeInstanceOf(OrderCreated);
    });
  });

  describe('replaySelective()', () => {
    it('only replays specified event types', async () => {
      const store = await seedStore();
      const replayer = new EventReplayer(store);
      const received: DomainEvent[] = [];
      await replayer.replaySelective('order-1', ['OrderCreated', 'OrderCancelled'], (e) =>
        received.push(e),
      );
      expect(received).toHaveLength(2);
      expect(received.some((e) => e instanceof OrderShipped)).toBe(false);
    });

    it('skipped count reflects filtered events', async () => {
      const store = await seedStore();
      const replayer = new EventReplayer(store);
      const stats = await replayer.replaySelective('order-1', ['OrderCreated'], () => undefined);
      expect(stats.eventsProcessed).toBe(1);
      expect(stats.eventsSkipped).toBe(2);
    });
  });

  describe('fastForward()', () => {
    it('replays from a given version to skip prior history', async () => {
      const store = await seedStore();
      const replayer = new EventReplayer(store);
      const received: DomainEvent[] = [];
      await replayer.fastForward('order-1', 2, (e) => received.push(e));
      expect(received).toHaveLength(1);
      expect(received[0]).toBeInstanceOf(OrderCancelled);
    });
  });

  it('calls onProgress callback for each event', async () => {
    const store = await seedStore();
    const replayer = new EventReplayer(store);
    const progressUpdates: number[] = [];
    await replayer.replay(
      'order-1',
      () => undefined,
      {},
      (p) => progressUpdates.push(p.eventsProcessed),
    );
    expect(progressUpdates).toStrictEqual([1, 2, 3]);
  });
});

// ─── ReplayMonitor ────────────────────────────────────────────────────────────

describe('ReplayMonitor', () => {
  it('latest is null before replay', () => {
    const monitor = new ReplayMonitor('stream-1');
    expect(monitor.latest).toBeNull();
  });

  it('accumulates progress during replay', async () => {
    const store = await seedStore();
    const replayer = new EventReplayer(store);
    const monitor = new ReplayMonitor('order-1');
    await replayer.replay('order-1', () => undefined, {}, monitor.callback);
    expect(monitor.latest?.eventsProcessed).toBe(3);
    expect(monitor.currentVersion).toBe(2);
  });

  it('onProgress() listener receives updates', async () => {
    const store = await seedStore();
    const replayer = new EventReplayer(store);
    const monitor = new ReplayMonitor('order-1');
    const updates: number[] = [];
    monitor.onProgress((p) => updates.push(p.currentVersion));
    await replayer.replay('order-1', () => undefined, {}, monitor.callback);
    expect(updates).toStrictEqual([0, 1, 2]);
  });

  it('unsubscribing onProgress stops receiving updates', async () => {
    const store = await seedStore();
    const replayer = new EventReplayer(store);
    const monitor = new ReplayMonitor('order-1');
    const handler = vi.fn();
    const unsub = monitor.onProgress(handler);
    unsub();
    await replayer.replay('order-1', () => undefined, {}, monitor.callback);
    expect(handler).not.toHaveBeenCalled();
  });

  it('processed shorthand reflects eventsProcessed', async () => {
    const store = await seedStore();
    const replayer = new EventReplayer(store);
    const monitor = new ReplayMonitor('order-1');
    await replayer.replay('order-1', () => undefined, {}, monitor.callback);
    expect(monitor.processed).toBe(3);
  });

  it('reset() clears accumulated state', async () => {
    const store = await seedStore();
    const replayer = new EventReplayer(store);
    const monitor = new ReplayMonitor('order-1');
    await replayer.replay('order-1', () => undefined, {}, monitor.callback);
    monitor.reset();
    expect(monitor.latest).toBeNull();
    expect(monitor.processed).toBe(0);
  });
});
