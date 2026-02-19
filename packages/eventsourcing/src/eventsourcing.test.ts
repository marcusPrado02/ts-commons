/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { describe, it, expect, vi } from 'vitest';
import { DomainEvent } from '@acme/kernel';
import { InMemoryEventStore, ConcurrencyError } from './EventStore';
import { EventSourcedAggregate } from './EventSourcedAggregate';
import { InMemorySnapshotStore } from './Snapshot';
import type { Projection } from './Projection';
import { ProjectionRunner } from './Projection';

// ---------------------------------------------------------------------------
// Shared domain fixtures
// ---------------------------------------------------------------------------

class CounterIncremented extends DomainEvent {
  constructor(readonly by: number) {
    super();
  }
}

class CounterReset extends DomainEvent {}

class Counter extends EventSourcedAggregate<string> {
  private _count = 0;

  constructor(id: string) {
    super(id);
  }

  static create(id: string): Counter {
    const c = new Counter(id);
    c.raise(new CounterIncremented(0));
    return c;
  }

  increment(by = 1): void {
    this.raise(new CounterIncremented(by));
  }

  reset(): void {
    this.raise(new CounterReset());
  }

  get count(): number {
    return this._count;
  }

  protected apply(event: DomainEvent): void {
    if (event instanceof CounterIncremented) this._count += event.by;
    if (event instanceof CounterReset) this._count = 0;
  }
}

// ---------------------------------------------------------------------------
// Suite 1: InMemoryEventStore
// ---------------------------------------------------------------------------

describe('InMemoryEventStore', () => {
  it('append then getEvents returns all stored events', async () => {
    const store = new InMemoryEventStore();
    const e1 = new CounterIncremented(1);
    const e2 = new CounterIncremented(2);
    await store.append('stream-1', [e1, e2], 0);
    const events = await store.getEvents('stream-1');
    expect(events).toHaveLength(2);
    expect(events[0]).toBe(e1);
    expect(events[1]).toBe(e2);
  });

  it('getEvents with fromVersion slices from that index', async () => {
    const store = new InMemoryEventStore();
    const events = [
      new CounterIncremented(1),
      new CounterIncremented(2),
      new CounterIncremented(3),
    ];
    await store.append('stream-1', events, 0);
    const from2 = await store.getEvents('stream-1', 2);
    expect(from2).toHaveLength(1);
    expect(from2[0]).toBe(events[2]);
  });

  it('append with wrong expectedVersion throws ConcurrencyError', async () => {
    const store = new InMemoryEventStore();
    await store.append('stream-1', [new CounterIncremented(1)], 0);
    await expect(store.append('stream-1', [new CounterIncremented(2)], 0)).rejects.toBeInstanceOf(
      ConcurrencyError,
    );
  });

  it('two different streams are isolated', async () => {
    const store = new InMemoryEventStore();
    await store.append('stream-a', [new CounterIncremented(1)], 0);
    await store.append('stream-b', [new CounterReset()], 0);
    expect(await store.getEvents('stream-a')).toHaveLength(1);
    expect(await store.getEvents('stream-b')).toHaveLength(1);
    expect(await store.getEvents('stream-a')).not.toEqual(await store.getEvents('stream-b'));
  });

  it('subscribe receives appended events; unsubscribe stops delivery', async () => {
    const store = new InMemoryEventStore();
    const received: DomainEvent[] = [];
    const unsub = store.subscribe((e) => received.push(e));

    const e1 = new CounterIncremented(1);
    await store.append('stream-1', [e1], 0);
    expect(received).toHaveLength(1);
    expect(received[0]).toBe(e1);

    unsub();
    await store.append('stream-1', [new CounterIncremented(2)], 1);
    expect(received).toHaveLength(1); // no new events after unsub
  });
});

// ---------------------------------------------------------------------------
// Suite 2: EventSourcedAggregate
// ---------------------------------------------------------------------------

describe('EventSourcedAggregate', () => {
  it('loadFromHistory applies events and sets version correctly', () => {
    const counter = new Counter('c-1');
    counter.loadFromHistory([new CounterIncremented(5), new CounterIncremented(3)]);
    expect(counter.count).toBe(8);
    expect(counter.version).toBe(2);
  });

  it('raise() applies the event, increments version, queues as uncommitted', () => {
    const counter = Counter.create('c-1');
    expect(counter.version).toBe(1);
    counter.increment(10);
    expect(counter.count).toBe(10);
    expect(counter.version).toBe(2);
    expect(counter.getUncommittedEvents()).toHaveLength(2);
  });

  it('getUncommittedEvents() returns all events raised since construction', () => {
    const counter = Counter.create('c-2');
    counter.increment(1);
    counter.increment(2);
    const uncommitted = counter.getUncommittedEvents();
    expect(uncommitted).toHaveLength(3); // create + 2 increments
  });

  it('markCommitted() clears the uncommitted events list', () => {
    const counter = Counter.create('c-3');
    counter.increment(5);
    expect(counter.getUncommittedEvents()).toHaveLength(2);
    counter.markCommitted();
    expect(counter.getUncommittedEvents()).toHaveLength(0);
  });

  it('version reflects total events applied (history + new raises)', () => {
    const counter = new Counter('c-4');
    counter.loadFromHistory([new CounterIncremented(1), new CounterIncremented(2)]);
    expect(counter.version).toBe(2);
    counter.increment(3);
    expect(counter.version).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Suite 3: InMemorySnapshotStore
// ---------------------------------------------------------------------------

interface CounterState {
  count: number;
}

describe('InMemorySnapshotStore', () => {
  it('save then get returns the correct snapshot', async () => {
    const store = new InMemorySnapshotStore();
    await store.save<CounterState>({ aggregateId: 'c-1', version: 5, state: { count: 42 }, timestamp: new Date() });
    const snap = await store.get<CounterState>('c-1');
    expect(snap).toBeDefined();
    expect(snap?.state.count).toBe(42);
    expect(snap?.version).toBe(5);
  });

  it('get returns undefined for unknown aggregate id', async () => {
    const store = new InMemorySnapshotStore();
    const snap = await store.get('unknown');
    expect(snap).toBeUndefined();
  });

  it('latest save replaces previous snapshot for same id', async () => {
    const store = new InMemorySnapshotStore();
    const ts1 = new Date(1000);
    const ts2 = new Date(2000);
    await store.save<CounterState>({ aggregateId: 'c-1', version: 5, state: { count: 10 }, timestamp: ts1 });
    await store.save<CounterState>({ aggregateId: 'c-1', version: 10, state: { count: 20 }, timestamp: ts2 });
    const snap = await store.get<CounterState>('c-1');
    expect(snap?.version).toBe(10);
    expect(snap?.state.count).toBe(20);
  });

  it('all snapshot fields are preserved exactly', async () => {
    const store = new InMemorySnapshotStore();
    const timestamp = new Date('2026-01-01T00:00:00.000Z');
    await store.save<CounterState>({ aggregateId: 'agg-42', version: 7, state: { count: 99 }, timestamp });
    const snap = await store.get<CounterState>('agg-42');
    expect(snap).toMatchObject({ aggregateId: 'agg-42', version: 7, state: { count: 99 } });
    expect(snap?.timestamp).toBe(timestamp);
  });
});

// ---------------------------------------------------------------------------
// Suite 4: ProjectionRunner
// ---------------------------------------------------------------------------

class CounterProjection implements Projection<{ count: number; resets: number }> {
  state = { count: 0, resets: 0 };

  apply(event: DomainEvent): void {
    if (event instanceof CounterIncremented) this.state.count += event.by;
    if (event instanceof CounterReset) {
      this.state.count = 0;
      this.state.resets++;
    }
  }
}

describe('ProjectionRunner', () => {
  it('run() with empty events returns the initial state', () => {
    const runner = new ProjectionRunner(new CounterProjection());
    const state = runner.run([]);
    expect(state).toEqual({ count: 0, resets: 0 });
  });

  it('run() accumulates state across all events', () => {
    const runner = new ProjectionRunner(new CounterProjection());
    const state = runner.run([
      new CounterIncremented(5),
      new CounterIncremented(3),
      new CounterReset(),
      new CounterIncremented(2),
    ]);
    expect(state.count).toBe(2);
    expect(state.resets).toBe(1);
  });

  it('two independent runners over the same events produce the same result', () => {
    const events = [new CounterIncremented(10), new CounterIncremented(5)];
    const r1 = new ProjectionRunner(new CounterProjection());
    const r2 = new ProjectionRunner(new CounterProjection());
    expect(r1.run(events)).toEqual(r2.run(events));
  });

  it('run() can be called again to process additional events', () => {
    const runner = new ProjectionRunner(new CounterProjection());
    runner.run([new CounterIncremented(3)]);
    const state = runner.run([new CounterIncremented(7)]);
    expect(state.count).toBe(10);
  });

  it('currentState reflects accumulated state between run() calls', () => {
    const spy = vi.fn();
    const projection: Projection<number> = {
      state: 0,
      apply(event: DomainEvent) {
        if (event instanceof CounterIncremented) {
          this.state += event.by;
          spy();
        }
      },
    };
    const runner = new ProjectionRunner(projection);
    runner.run([new CounterIncremented(4), new CounterIncremented(6)]);
    expect(runner.currentState).toBe(10);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
