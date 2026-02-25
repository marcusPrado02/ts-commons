/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/require-await */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryReadModelStore,
  BaseProjection,
  ProjectionRebuildManager,
  ConsistencyMonitor,
  InMemorySnapshotStore,
  shouldTakeSnapshot,
} from '../src';
import type { ProjectedEvent, ReadModel, Projection, Snapshot } from '../src';

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface UserReadModel extends ReadModel {
  readonly id: string;
  name: string;
  email: string;
  version: number;
  updatedAt: Date;
}

function makeEvent(overrides: Partial<ProjectedEvent> = {}): ProjectedEvent {
  return {
    eventId: 'evt-1',
    eventType: 'UserCreated',
    aggregateId: 'user-1',
    aggregateVersion: 1,
    occurredAt: new Date('2026-01-01'),
    payload: { name: 'Alice', email: 'alice@example.com' },
    ...overrides,
  };
}

function makeUserModel(overrides: Partial<UserReadModel> = {}): UserReadModel {
  return {
    id: 'user-1',
    name: 'Alice',
    email: 'alice@example.com',
    version: 1,
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeSnapshot<T>(overrides: Partial<Snapshot<T>> = {}): Snapshot<T> {
  return {
    aggregateId: 'agg-1',
    version: 10,
    state: { count: 5 } as unknown as T,
    takenAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// Concrete projection for testing
class UserProjection extends BaseProjection<UserReadModel> {
  readonly name = 'UserProjection';
  readonly projected: ProjectedEvent[] = [];

  async project(event: ProjectedEvent): Promise<void> {
    this.projected.push(event);
    const p = event.payload as { name: string; email: string } | undefined;
    if (event.eventType === 'UserCreated' && p) {
      await this.store.save({
        id: event.aggregateId,
        name: p.name,
        email: p.email,
        version: event.aggregateVersion,
        updatedAt: event.occurredAt,
      });
    }
    if (event.eventType === 'UserNameUpdated' && p) {
      const existing = await this.store.findById(event.aggregateId);
      if (existing !== undefined) {
        await this.store.save({ ...existing, name: p.name, version: event.aggregateVersion });
      }
    }
  }
}

// ─── InMemoryReadModelStore ───────────────────────────────────────────────────

describe('InMemoryReadModelStore', () => {
  let store: InMemoryReadModelStore<UserReadModel>;

  beforeEach(() => {
    store = new InMemoryReadModelStore();
  });

  it('starts empty', () => {
    expect(store.size()).toBe(0);
  });

  it('save() persists a model', async () => {
    await store.save(makeUserModel());
    expect(store.size()).toBe(1);
  });

  it('findById() returns the saved model', async () => {
    await store.save(makeUserModel());
    const found = await store.findById('user-1');
    expect(found?.name).toBe('Alice');
  });

  it('findById() returns undefined for unknown id', async () => {
    const found = await store.findById('unknown');
    expect(found).toBeUndefined();
  });

  it('findById() returns a copy (mutation does not affect store)', async () => {
    await store.save(makeUserModel());
    const found = await store.findById('user-1');
    found!.name = 'Mutated';
    const again = await store.findById('user-1');
    expect(again?.name).toBe('Alice');
  });

  it('save() overwrites existing model', async () => {
    await store.save(makeUserModel());
    await store.save(makeUserModel({ name: 'Bob' }));
    const found = await store.findById('user-1');
    expect(found?.name).toBe('Bob');
    expect(store.size()).toBe(1);
  });

  it('findAll() returns all models', async () => {
    await store.save(makeUserModel({ id: 'user-1', name: 'Alice' }));
    await store.save(makeUserModel({ id: 'user-2', name: 'Bob' }));
    const all = await store.findAll();
    expect(all).toHaveLength(2);
  });

  it('findAll() returns copies', async () => {
    await store.save(makeUserModel());
    const all = await store.findAll();
    all[0]!.name = 'Mutated';
    const again = await store.findAll();
    expect(again[0]!.name).toBe('Alice');
  });

  it('delete() removes a model', async () => {
    await store.save(makeUserModel());
    await store.delete('user-1');
    expect(store.size()).toBe(0);
  });

  it('delete() on unknown id is a no-op', async () => {
    await store.delete('nonexistent');
    expect(store.size()).toBe(0);
  });
});

// ─── BaseProjection ───────────────────────────────────────────────────────────

describe('BaseProjection', () => {
  let store: InMemoryReadModelStore<UserReadModel>;
  let projection: UserProjection;

  beforeEach(() => {
    store = new InMemoryReadModelStore();
    projection = new UserProjection(store);
  });

  it('has a name', () => {
    expect(projection.name).toBe('UserProjection');
  });

  it('project() writes to the store', async () => {
    await projection.project(makeEvent());
    expect(store.size()).toBe(1);
  });

  it('project() stores event details', async () => {
    await projection.project(makeEvent());
    const model = await store.findById('user-1');
    expect(model?.name).toBe('Alice');
    expect(model?.email).toBe('alice@example.com');
  });

  it('project() handles update events', async () => {
    await projection.project(makeEvent());
    const updateEvent = makeEvent({
      eventId: 'evt-2',
      eventType: 'UserNameUpdated',
      aggregateVersion: 2,
      payload: { name: 'Alice Updated', email: 'alice@example.com' },
    });
    await projection.project(updateEvent);
    const model = await store.findById('user-1');
    expect(model?.name).toBe('Alice Updated');
    expect(model?.version).toBe(2);
  });

  it('reset() clears all models from the store', async () => {
    await projection.project(makeEvent({ aggregateId: 'user-1' }));
    await projection.project(makeEvent({ eventId: 'e2', aggregateId: 'user-2' }));
    await projection.reset();
    expect(store.size()).toBe(0);
  });

  it('reset() allows reprojecting after', async () => {
    await projection.project(makeEvent());
    await projection.reset();
    await projection.project(makeEvent({ payload: { name: 'Rebuilt', email: 'r@x.com' } }));
    const model = await store.findById('user-1');
    expect(model?.name).toBe('Rebuilt');
  });
});

// ─── ProjectionRebuildManager ─────────────────────────────────────────────────

describe('ProjectionRebuildManager', () => {
  let manager: ProjectionRebuildManager;
  let projection: UserProjection;

  beforeEach(() => {
    manager = new ProjectionRebuildManager();
    projection = new UserProjection(new InMemoryReadModelStore());
    manager.register(projection);
  });

  it('getRegisteredProjections() lists registered names', () => {
    expect(manager.getRegisteredProjections()).toContain('UserProjection');
  });

  it('rebuild() processes all events', async () => {
    const events = [makeEvent(), makeEvent({ eventId: 'e2', aggregateId: 'user-2' })];
    const result = await manager.rebuild('UserProjection', events);
    expect(result.eventsProcessed).toBe(2);
  });

  it('rebuild() returns projectionName', async () => {
    const result = await manager.rebuild('UserProjection', [makeEvent()]);
    expect(result.projectionName).toBe('UserProjection');
  });

  it('rebuild() records durationMs', async () => {
    const result = await manager.rebuild('UserProjection', [makeEvent()]);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('rebuild() counts errors without throwing', async () => {
    const failProjection: Projection = {
      name: 'FailProjection',
      project: async () => {
        throw new Error('boom');
      },
      reset: async () => {
        /* no-op */
      },
    };
    manager.register(failProjection);
    const result = await manager.rebuild('FailProjection', [
      makeEvent(),
      makeEvent({ eventId: 'e2' }),
    ]);
    expect(result.errors).toBe(2);
    expect(result.eventsProcessed).toBe(2);
  });

  it('rebuild() resets projection before replaying', async () => {
    await projection.project(makeEvent({ payload: { name: 'Stale', email: 's@s.com' } }));
    const events = [makeEvent({ payload: { name: 'Fresh', email: 'f@f.com' } })];
    await manager.rebuild('UserProjection', events);
    const model = await projection['store'].findById('user-1');
    expect(model?.name).toBe('Fresh');
  });

  it('rebuild() throws for unregistered projection', async () => {
    await expect(manager.rebuild('UnknownProjection', [])).rejects.toThrow(
      'Projection not registered: UnknownProjection',
    );
  });

  it('rebuildAll() rebuilds all registered projections', async () => {
    const events = [makeEvent()];
    const results = await manager.rebuildAll(events);
    expect(results.has('UserProjection')).toBe(true);
    expect(results.get('UserProjection')?.eventsProcessed).toBe(1);
  });

  it('rebuildAll() returns empty map when no projections registered', async () => {
    const emptyManager = new ProjectionRebuildManager();
    const results = await emptyManager.rebuildAll([makeEvent()]);
    expect(results.size).toBe(0);
  });
});

// ─── ConsistencyMonitor ───────────────────────────────────────────────────────

describe('ConsistencyMonitor', () => {
  let monitor: ConsistencyMonitor;

  beforeEach(() => {
    monitor = new ConsistencyMonitor();
  });

  it('getAverageLag returns 0 for unknown projection', () => {
    expect(monitor.getAverageLag('unknown')).toBe(0);
  });

  it('getMaxLag returns 0 for unknown projection', () => {
    expect(monitor.getMaxLag('unknown')).toBe(0);
  });

  it('getSampleCount returns 0 for unknown projection', () => {
    expect(monitor.getSampleCount('unknown')).toBe(0);
  });

  it('recordLag() increments sample count', () => {
    monitor.recordLag('proj', 100);
    expect(monitor.getSampleCount('proj')).toBe(1);
  });

  it('getAverageLag() computes the mean', () => {
    monitor.recordLag('proj', 100);
    monitor.recordLag('proj', 200);
    expect(monitor.getAverageLag('proj')).toBe(150);
  });

  it('getMaxLag() returns the highest value', () => {
    monitor.recordLag('proj', 50);
    monitor.recordLag('proj', 300);
    monitor.recordLag('proj', 120);
    expect(monitor.getMaxLag('proj')).toBe(300);
  });

  it('isHealthy() returns true when max lag within threshold', () => {
    monitor.recordLag('proj', 4000);
    expect(monitor.isHealthy('proj', 5000)).toBe(true);
  });

  it('isHealthy() returns false when max lag exceeds threshold', () => {
    monitor.recordLag('proj', 6000);
    expect(monitor.isHealthy('proj', 5000)).toBe(false);
  });

  it('isHealthy() uses default threshold of 5000ms', () => {
    monitor.recordLag('proj', 5001);
    expect(monitor.isHealthy('proj')).toBe(false);
  });

  it('isHealthy() returns true for unknown projection', () => {
    expect(monitor.isHealthy('new-proj')).toBe(true);
  });

  it('getReport() includes all recorded projections', () => {
    monitor.recordLag('p1', 100);
    monitor.recordLag('p2', 200);
    const report = monitor.getReport();
    expect(Object.keys(report.projections)).toContain('p1');
    expect(Object.keys(report.projections)).toContain('p2');
  });

  it('getReport() sets overallHealthy false when any projection is slow', () => {
    monitor.recordLag('fast', 100);
    monitor.recordLag('slow', 9999);
    const report = monitor.getReport(5000);
    expect(report.overallHealthy).toBe(false);
  });

  it('getReport() sets overallHealthy true when all projections are healthy', () => {
    monitor.recordLag('p1', 100);
    monitor.recordLag('p2', 200);
    const report = monitor.getReport(5000);
    expect(report.overallHealthy).toBe(true);
  });

  it('reset() clears all lag data', () => {
    monitor.recordLag('proj', 500);
    monitor.reset();
    expect(monitor.getSampleCount('proj')).toBe(0);
    expect(monitor.getAverageLag('proj')).toBe(0);
  });

  it('getReport() returns empty projections after reset', () => {
    monitor.recordLag('proj', 500);
    monitor.reset();
    const report = monitor.getReport();
    expect(Object.keys(report.projections)).toHaveLength(0);
    expect(report.overallHealthy).toBe(true);
  });
});

// ─── InMemorySnapshotStore ────────────────────────────────────────────────────

describe('InMemorySnapshotStore', () => {
  let snapshotStore: InMemorySnapshotStore<{ count: number }>;

  beforeEach(() => {
    snapshotStore = new InMemorySnapshotStore();
  });

  it('starts with size 0', () => {
    expect(snapshotStore.size()).toBe(0);
  });

  it('save() stores a snapshot', async () => {
    await snapshotStore.save(makeSnapshot());
    expect(snapshotStore.size()).toBe(1);
  });

  it('findLatest() returns the most recent snapshot by version', async () => {
    await snapshotStore.save(makeSnapshot({ version: 10, state: { count: 10 } }));
    await snapshotStore.save(makeSnapshot({ version: 20, state: { count: 20 } }));
    const latest = await snapshotStore.findLatest('agg-1');
    expect(latest?.version).toBe(20);
    expect(latest?.state.count).toBe(20);
  });

  it('findLatest() returns undefined when no snapshots exist', async () => {
    expect(await snapshotStore.findLatest('missing')).toBeUndefined();
  });

  it('findByVersion() returns the exact snapshot', async () => {
    await snapshotStore.save(makeSnapshot({ version: 10, state: { count: 10 } }));
    await snapshotStore.save(makeSnapshot({ version: 20, state: { count: 20 } }));
    const snap = await snapshotStore.findByVersion('agg-1', 10);
    expect(snap?.state.count).toBe(10);
  });

  it('findByVersion() returns undefined for unknown version', async () => {
    await snapshotStore.save(makeSnapshot({ version: 10 }));
    expect(await snapshotStore.findByVersion('agg-1', 99)).toBeUndefined();
  });

  it('findLatest() returns a copy (mutation does not affect store)', async () => {
    await snapshotStore.save(makeSnapshot({ state: { count: 5 } }));
    const snap = await snapshotStore.findLatest('agg-1');
    snap!.state.count = 999;
    const again = await snapshotStore.findLatest('agg-1');
    expect(again?.state.count).toBe(5);
  });

  it('delete() removes all snapshots for an aggregate', async () => {
    await snapshotStore.save(makeSnapshot({ version: 10 }));
    await snapshotStore.save(makeSnapshot({ version: 20 }));
    await snapshotStore.delete('agg-1');
    expect(snapshotStore.size()).toBe(0);
  });

  it('delete() only removes the targeted aggregate', async () => {
    await snapshotStore.save(makeSnapshot({ aggregateId: 'agg-1', version: 10 }));
    await snapshotStore.save(makeSnapshot({ aggregateId: 'agg-2', version: 10 }));
    await snapshotStore.delete('agg-1');
    expect(snapshotStore.size()).toBe(1);
    expect(await snapshotStore.findLatest('agg-2')).toBeDefined();
  });

  it('size() counts snapshots across all aggregates', async () => {
    await snapshotStore.save(makeSnapshot({ aggregateId: 'agg-1', version: 10 }));
    await snapshotStore.save(makeSnapshot({ aggregateId: 'agg-1', version: 20 }));
    await snapshotStore.save(makeSnapshot({ aggregateId: 'agg-2', version: 10 }));
    expect(snapshotStore.size()).toBe(3);
  });
});

// ─── shouldTakeSnapshot ────────────────────────────────────────────────────────

describe('shouldTakeSnapshot', () => {
  it('returns true at the default interval (version 10)', () => {
    expect(shouldTakeSnapshot(10)).toBe(true);
  });

  it('returns true at multiples of the default interval', () => {
    expect(shouldTakeSnapshot(20)).toBe(true);
    expect(shouldTakeSnapshot(30)).toBe(true);
  });

  it('returns false for versions not at the interval boundary', () => {
    expect(shouldTakeSnapshot(9)).toBe(false);
    expect(shouldTakeSnapshot(11)).toBe(false);
    expect(shouldTakeSnapshot(15)).toBe(false);
  });

  it('returns false for version 0', () => {
    expect(shouldTakeSnapshot(0)).toBe(false);
  });

  it('respects a custom interval', () => {
    expect(shouldTakeSnapshot(5, 5)).toBe(true);
    expect(shouldTakeSnapshot(10, 5)).toBe(true);
    expect(shouldTakeSnapshot(7, 5)).toBe(false);
  });
});
