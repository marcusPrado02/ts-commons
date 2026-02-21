/* eslint-disable @typescript-eslint/require-await -- test factory functions intentionally omit await */
/* eslint-disable @typescript-eslint/no-unsafe-call -- Vitest mock call patterns */
/**
 * Tests for @acme/persistence — query optimization (Item 49)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DataLoader } from './query/DataLoader';
import { N1Detector } from './query/N1Detector';
import { QueryResultCache } from './query/QueryResultCache';
import { ConnectionPoolMonitor } from './query/ConnectionPoolMonitor';
import { QueryPlanner } from './query/QueryPlanner';
import type { PoolSnapshot } from './query/QueryTypes';

// ── DataLoader ────────────────────────────────────────────────────────────────

describe('DataLoader', () => {
  it('loads a single value via batchFn', async () => {
    const loader = new DataLoader<string, number>(async (keys) => {
      const m = new Map<string, number>();
      for (const k of keys) m.set(k, k.length);
      return m;
    });
    const result = await loader.load('hello');
    expect(result).toBe(5);
  });

  it('returns null when key is absent from batchFn result', async () => {
    const loader = new DataLoader<string, number>(async (_keys) => new Map());
    const result = await loader.load('missing');
    expect(result).toBeNull();
  });

  it('batches concurrent load() calls into a single batchFn invocation', async () => {
    let batchCount = 0;
    const loader = new DataLoader<string, string>(async (keys) => {
      batchCount++;
      return new Map(keys.map((k) => [k, k.toUpperCase()]));
    });
    const [a, b, c] = await Promise.all([loader.load('a'), loader.load('b'), loader.load('c')]);
    expect(batchCount).toBe(1);
    expect(a).toBe('A');
    expect(b).toBe('B');
    expect(c).toBe('C');
  });

  it('caches results — repeated load() for same key does not re-batch', async () => {
    let callCount = 0;
    const loader = new DataLoader<string, number>(async (keys) => {
      callCount++;
      return new Map(keys.map((k, i) => [k, i]));
    });
    await loader.load('x');
    await loader.load('x');
    expect(callCount).toBe(1);
  });

  it('clear() removes key from cache so next load re-fetches', async () => {
    let callCount = 0;
    const loader = new DataLoader<string, number>(async (keys) => {
      callCount++;
      return new Map(keys.map((k) => [k, callCount]));
    });
    await loader.load('k');
    loader.clear('k');
    await loader.load('k');
    expect(callCount).toBe(2);
  });

  it('clearAll() empties the cache', async () => {
    let callCount = 0;
    const loader = new DataLoader<string, number>(async (keys) => {
      callCount++;
      return new Map(keys.map((k) => [k, callCount]));
    });
    await loader.load('a');
    await loader.load('b');
    loader.clearAll();
    expect(loader.cacheSize()).toBe(0);
    await loader.load('a');
    expect(callCount).toBe(3); // initial a, initial b, reload a
  });

  it('prime() pre-seeds cache without calling batchFn', async () => {
    let callCount = 0;
    const loader = new DataLoader<string, number>(async (_keys) => {
      callCount++;
      return new Map();
    });
    loader.prime('x', 42);
    const result = await loader.load('x');
    expect(result).toBe(42);
    expect(callCount).toBe(0);
  });

  it('cacheSize() reflects the number of cached entries', async () => {
    const loader = new DataLoader<string, number>(async (keys) => new Map(keys.map((k) => [k, 0])));
    await Promise.all([loader.load('a'), loader.load('b')]);
    expect(loader.cacheSize()).toBe(2);
  });

  it('rejects all keys in a batch when batchFn rejects', async () => {
    const loader = new DataLoader<string, number>(async (_keys) => {
      throw new Error('DB error');
    });
    await expect(loader.load('k')).rejects.toThrow('DB error');
  });
});

// ── N1Detector ────────────────────────────────────────────────────────────────

describe('N1Detector', () => {
  let detector: N1Detector;

  beforeEach(() => {
    detector = new N1Detector();
  });

  it('detect() returns empty when no queries recorded', () => {
    expect(detector.detect(1000, 3)).toHaveLength(0);
  });

  it('detect() returns pattern when threshold exceeded', () => {
    const query = 'SELECT * FROM users WHERE id = ?';
    for (let i = 0; i < 5; i++) detector.record(query);
    const patterns = detector.detect(5000, 3);
    expect(patterns).toHaveLength(1);
    expect(patterns[0]?.count).toBe(5);
  });

  it('detect() returns empty when count below threshold', () => {
    detector.record('SELECT 1');
    detector.record('SELECT 1');
    expect(detector.detect(5000, 3)).toHaveLength(0);
  });

  it('normalizes queries before comparing (case-insensitive)', () => {
    detector.record('SELECT * FROM orders WHERE id = 1');
    detector.record('select * from orders where id = 1');
    detector.record('SELECT * FROM orders WHERE id = 1');
    const patterns = detector.detect(5000, 2);
    expect(patterns).toHaveLength(1);
    expect(patterns[0]?.count).toBe(3);
  });

  it('normalizes extra whitespace in queries', () => {
    detector.record('SELECT   *  FROM   users');
    detector.record('SELECT * FROM users');
    expect(detector.detect(5000, 2)[0]?.count).toBe(2);
  });

  it('trackedQueryCount() returns distinct normalized queries', () => {
    detector.record('SELECT * FROM a');
    detector.record('SELECT * FROM b');
    detector.record('SELECT * FROM a');
    expect(detector.trackedQueryCount()).toBe(2);
  });

  it('clear() resets all tracked data', () => {
    detector.record('SELECT 1');
    detector.clear();
    expect(detector.trackedQueryCount()).toBe(0);
    expect(detector.detect(5000, 1)).toHaveLength(0);
  });

  it('prune() removes records older than windowMs', () => {
    vi.useFakeTimers();
    detector.record('SELECT 1');
    vi.advanceTimersByTime(2000);
    detector.prune(1000);
    expect(detector.detect(5000, 1)).toHaveLength(0);
    vi.useRealTimers();
  });

  it('detect() respects the windowMs cutoff', () => {
    vi.useFakeTimers();
    detector.record('SELECT 1');
    vi.advanceTimersByTime(5000);
    // Old record outside 1-second window — below threshold
    const patterns = detector.detect(1000, 1);
    expect(patterns).toHaveLength(0);
    vi.useRealTimers();
  });
});

// ── QueryResultCache ──────────────────────────────────────────────────────────

describe('QueryResultCache', () => {
  let cache: QueryResultCache;

  beforeEach(() => {
    cache = new QueryResultCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('executes factory on cache miss and returns value', async () => {
    const value = await cache.execute('k', async () => 42);
    expect(value).toBe(42);
  });

  it('returns cached value on second call without calling factory again', async () => {
    let callCount = 0;
    await cache.execute('k', async () => {
      callCount++;
      return 42;
    });
    const second = await cache.execute('k', async () => {
      callCount++;
      return 99;
    });
    expect(second).toBe(42);
    expect(callCount).toBe(1);
  });

  it('cached value expires after ttlMs', async () => {
    vi.useFakeTimers();
    await cache.execute('k', async () => 1, 100);
    vi.advanceTimersByTime(101);
    let callCount = 0;
    await cache.execute('k', async () => {
      callCount++;
      return 2;
    });
    expect(callCount).toBe(1);
  });

  it('cached value does not expire without TTL', async () => {
    vi.useFakeTimers();
    await cache.execute('k', async () => 'v');
    vi.advanceTimersByTime(999_999);
    let callCount = 0;
    await cache.execute('k', async () => {
      callCount++;
      return 'other';
    });
    expect(callCount).toBe(0);
  });

  it('invalidate() removes a specific entry', async () => {
    await cache.execute('k', async () => 1);
    cache.invalidate('k');
    let callCount = 0;
    await cache.execute('k', async () => {
      callCount++;
      return 2;
    });
    expect(callCount).toBe(1);
  });

  it('invalidateByPrefix() removes all matching keys', async () => {
    await cache.execute('user:1', async () => 'a');
    await cache.execute('user:2', async () => 'b');
    await cache.execute('order:1', async () => 'c');
    cache.invalidateByPrefix('user:');
    expect(cache.has('user:1')).toBe(false);
    expect(cache.has('user:2')).toBe(false);
    expect(cache.has('order:1')).toBe(true);
  });

  it('clear() empties all entries', async () => {
    await cache.execute('a', async () => 1);
    await cache.execute('b', async () => 2);
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it('size() reflects number of cached entries', async () => {
    await cache.execute('x', async () => 1);
    await cache.execute('y', async () => 2);
    expect(cache.size()).toBe(2);
  });

  it('has() returns true for live cached entry', async () => {
    await cache.execute('k', async () => 1);
    expect(cache.has('k')).toBe(true);
  });

  it('has() returns false for unknown key', () => {
    expect(cache.has('missing')).toBe(false);
  });

  it('has() returns false for expired entry', async () => {
    vi.useFakeTimers();
    await cache.execute('k', async () => 1, 50);
    vi.advanceTimersByTime(51);
    expect(cache.has('k')).toBe(false);
  });
});

// ── ConnectionPoolMonitor ─────────────────────────────────────────────────────

describe('ConnectionPoolMonitor', () => {
  let monitor: ConnectionPoolMonitor;

  const snap = (overrides: Partial<PoolSnapshot> = {}): PoolSnapshot => ({
    total: 10,
    active: 5,
    idle: 5,
    waiting: 0,
    timestamp: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    monitor = new ConnectionPoolMonitor();
  });

  it('recommend() returns "ok" when no data recorded', () => {
    expect(monitor.recommend(2, 0.5).type).toBe('ok');
  });

  it('getSnapshots() returns recorded snapshots', () => {
    monitor.record(snap());
    expect(monitor.getSnapshots()).toHaveLength(1);
  });

  it('recommend() returns "increase-pool-size" when waiting exceeds threshold', () => {
    monitor.record(snap({ waiting: 5 }));
    const rec = monitor.recommend(2, 0.5);
    expect(rec.type).toBe('increase-pool-size');
  });

  it('recommend() returns "decrease-pool-size" when idle ratio is too high', () => {
    monitor.record(snap({ total: 10, active: 1, idle: 9, waiting: 0 }));
    const rec = monitor.recommend(2, 0.5); // idle = 90% > 50%
    expect(rec.type).toBe('decrease-pool-size');
  });

  it('recommend() returns "ok" for healthy utilization', () => {
    monitor.record(snap({ total: 10, active: 7, idle: 3, waiting: 0 }));
    const rec = monitor.recommend(2, 0.5);
    expect(rec.type).toBe('ok');
  });

  it('recommend() includes reason text', () => {
    monitor.record(snap({ waiting: 10 }));
    expect(monitor.recommend(2, 0.5).reason.length).toBeGreaterThan(0);
  });

  it('averageActiveConnections() equals mean active across snapshots', () => {
    monitor.record(snap({ active: 4 }));
    monitor.record(snap({ active: 6 }));
    expect(monitor.averageActiveConnections()).toBe(5);
  });

  it('averageActiveConnections() returns 0 when no data', () => {
    expect(monitor.averageActiveConnections()).toBe(0);
  });

  it('peakWaiting() returns highest waiting value', () => {
    monitor.record(snap({ waiting: 1 }));
    monitor.record(snap({ waiting: 7 }));
    monitor.record(snap({ waiting: 3 }));
    expect(monitor.peakWaiting()).toBe(7);
  });

  it('peakWaiting() returns 0 when no data', () => {
    expect(monitor.peakWaiting()).toBe(0);
  });

  it('snapshotCount() reflects recorded count', () => {
    monitor.record(snap());
    monitor.record(snap());
    expect(monitor.snapshotCount()).toBe(2);
  });

  it('clear() removes all snapshots', () => {
    monitor.record(snap());
    monitor.clear();
    expect(monitor.snapshotCount()).toBe(0);
  });
});

// ── QueryPlanner ──────────────────────────────────────────────────────────────

describe('QueryPlanner', () => {
  let planner: QueryPlanner;

  beforeEach(() => {
    planner = new QueryPlanner();
  });

  it('recordSlowQuery() stores logs retrievable via getSlowLogs()', () => {
    planner.recordSlowQuery('SELECT 1', 500, 'users');
    expect(planner.getSlowLogs()).toHaveLength(1);
  });

  it('recommendIndexes() returns empty when no queries exceed threshold', () => {
    planner.recordSlowQuery('SELECT 1', 100, 'users');
    expect(planner.recommendIndexes(200)).toHaveLength(0);
  });

  it('recommendIndexes() filters by threshold', () => {
    planner.recordSlowQuery('SELECT * FROM orders WHERE customer_id = 1', 1000, 'orders');
    const recs = planner.recommendIndexes(500);
    expect(recs).toHaveLength(1);
    expect(recs[0]?.table).toBe('orders');
  });

  it('recommendIndexes() extracts columns from WHERE clause', () => {
    planner.recordSlowQuery('SELECT * FROM users WHERE email = ?', 900, 'users');
    const recs = planner.recommendIndexes(500);
    expect(recs[0]?.columns).toContain('email');
  });

  it('recommendIndexes() includes estimated improvement', () => {
    planner.recordSlowQuery('SELECT 1', 1000, 'tbl');
    const rec = planner.recommendIndexes(500)[0];
    expect(rec?.estimatedImprovementMs).toBeGreaterThan(0);
  });

  it('buildPlan() without WHERE contains only Seq Scan step', () => {
    const plan = planner.buildPlan('SELECT * FROM users', 'users');
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]?.operation).toBe('Seq Scan');
  });

  it('buildPlan() with WHERE includes Filter step', () => {
    const plan = planner.buildPlan('SELECT * FROM users WHERE id = 1', 'users');
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[1]?.operation).toBe('Filter');
  });

  it('buildPlan() totalCost equals sum of step costs', () => {
    const plan = planner.buildPlan('SELECT * FROM orders WHERE id = 1', 'orders', 500);
    const stepSum = plan.steps.reduce((s, p) => s + p.cost, 0);
    expect(plan.totalCost).toBe(stepSum);
  });

  it('buildPlan() uses estimatedRows parameter', () => {
    const plan = planner.buildPlan('SELECT * FROM t', 't', 200);
    expect(plan.steps[0]?.rows).toBe(200);
  });

  it('clear() removes all recorded slow logs', () => {
    planner.recordSlowQuery('SELECT 1', 1000, 'tbl');
    planner.clear();
    expect(planner.getSlowLogs()).toHaveLength(0);
  });
});
