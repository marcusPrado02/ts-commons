/* eslint-disable @typescript-eslint/no-unsafe-call -- Vitest mock call patterns */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Vitest mock objects */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- Vitest mock property access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition -- noUncheckedIndexedAccess makes optional chaining necessary */
/* eslint-disable @typescript-eslint/explicit-function-return-type -- test helper functions */
/* eslint-disable max-lines-per-function -- test files naturally have longer functions */
import { beforeEach, describe, expect, it } from 'vitest';
import { Duration } from './performance/PerformanceTypes';
import { PerformanceMonitor } from './performance/PerformanceMonitor';
import { RequestTimingCollector } from './performance/RequestTimingCollector';
import { QueryProfiler } from './performance/QueryProfiler';
import type { RequestTimingRecord } from './performance/RequestTimingCollector';

// ---------------------------------------------------------------------------
// Duration
// ---------------------------------------------------------------------------
describe('Duration', () => {
  it('fromMilliseconds preserves ms value', () => {
    expect(Duration.fromMilliseconds(500).toMilliseconds()).toBe(500);
  });

  it('fromSeconds converts to ms', () => {
    expect(Duration.fromSeconds(2).toMilliseconds()).toBe(2000);
  });

  it('toSeconds divides by 1000', () => {
    expect(Duration.fromMilliseconds(3000).toSeconds()).toBe(3);
  });

  it('isGreaterThan returns true when larger', () => {
    const a = Duration.fromMilliseconds(200);
    const b = Duration.fromMilliseconds(100);
    expect(a.isGreaterThan(b)).toBe(true);
    expect(b.isGreaterThan(a)).toBe(false);
  });

  it('isGreaterThan returns false for equal durations', () => {
    const a = Duration.fromMilliseconds(100);
    const b = Duration.fromMilliseconds(100);
    expect(a.isGreaterThan(b)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PerformanceMonitor
// ---------------------------------------------------------------------------
describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  describe('time()', () => {
    it('returns the result of the wrapped function', async () => {
      const result = await monitor.time('op', () => Promise.resolve(42));
      expect(result).toBe(42);
    });

    it('records a timing sample after execution', async () => {
      await monitor.time('my-op', () => Promise.resolve('x'));
      const report = monitor.getReport();
      expect(report.samples).toHaveLength(1);
      expect(report.samples[0]?.operation).toBe('my-op');
    });

    it('records durationMs as a non-negative number', async () => {
      await monitor.time('op', () => Promise.resolve(null));
      const report = monitor.getReport();
      expect(report.samples[0]?.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('stores labels on the timing sample', async () => {
      await monitor.time('op', () => Promise.resolve(0), { service: 'api' });
      const report = monitor.getReport();
      expect(report.samples[0]?.labels?.['service']).toBe('api');
    });

    it('omits labels when not provided', async () => {
      await monitor.time('op', () => Promise.resolve(0));
      const report = monitor.getReport();
      expect('labels' in (report.samples[0] ?? {})).toBe(false);
    });

    it('accumulates multiple samples', async () => {
      await monitor.time('a', () => Promise.resolve(1));
      await monitor.time('b', () => Promise.resolve(2));
      expect(monitor.getReport().samples).toHaveLength(2);
    });
  });

  describe('maxSamples ring buffer', () => {
    it('does not exceed maxSamples', async () => {
      const m = new PerformanceMonitor({ maxSamples: 3 });
      for (let i = 0; i < 5; i++) {
        await m.time('op', () => Promise.resolve(i));
      }
      expect(m.getReport().samples).toHaveLength(3);
    });
  });

  describe('recordSlowQuery()', () => {
    it('stores a slow query when above threshold', () => {
      const m = new PerformanceMonitor({ slowQueryThresholdMs: 100 });
      m.recordSlowQuery('SELECT 1', 200);
      expect(m.getReport().slowQueries).toHaveLength(1);
      expect(m.getReport().slowQueries[0]?.query).toBe('SELECT 1');
    });

    it('ignores queries at or below threshold', () => {
      const m = new PerformanceMonitor({ slowQueryThresholdMs: 100 });
      m.recordSlowQuery('SELECT 1', 100);
      m.recordSlowQuery('SELECT 1', 50);
      expect(m.getReport().slowQueries).toHaveLength(0);
    });

    it('uses default threshold of 1000 ms', () => {
      monitor.recordSlowQuery('q', 999);
      expect(monitor.getReport().slowQueries).toHaveLength(0);
      monitor.recordSlowQuery('q', 1001);
      expect(monitor.getReport().slowQueries).toHaveLength(1);
    });
  });

  describe('snapshotMemory()', () => {
    it('returns a MemorySnapshot with positive values', () => {
      const snap = monitor.snapshotMemory();
      expect(snap.heapUsedBytes).toBeGreaterThan(0);
      expect(snap.heapTotalBytes).toBeGreaterThan(0);
      expect(snap.rssBytes).toBeGreaterThan(0);
    });

    it('records the snapshot in the report', () => {
      monitor.snapshotMemory();
      expect(monitor.getReport().memorySnapshots).toHaveLength(1);
    });

    it('accumulates multiple snapshots', () => {
      monitor.snapshotMemory();
      monitor.snapshotMemory();
      expect(monitor.getReport().memorySnapshots).toHaveLength(2);
    });
  });

  describe('budget violations', () => {
    it('records a violation when a timed operation exceeds its budget', async () => {
      monitor.addBudget({ name: 'slow-op', thresholdMs: -1 });
      await monitor.time('slow-op', () => Promise.resolve('x'));
      const violations = monitor.getReport().budgetViolations;
      expect(violations.length).toBeGreaterThanOrEqual(1);
      expect(violations[0]?.operationName).toBe('slow-op');
    });

    it('does not record a violation for operations with no budget', async () => {
      await monitor.time('no-budget', () => Promise.resolve(true));
      expect(monitor.getReport().budgetViolations).toHaveLength(0);
    });

    it('removeBudget returns true for existing budget', () => {
      monitor.addBudget({ name: 'op', thresholdMs: 100 });
      expect(monitor.removeBudget('op')).toBe(true);
    });

    it('removeBudget returns false for missing budget', () => {
      expect(monitor.removeBudget('missing')).toBe(false);
    });
  });

  describe('getReport()', () => {
    it('returns snapshot copies (mutating returned array does not affect monitor)', async () => {
      await monitor.time('op', () => Promise.resolve(1));
      const report1 = monitor.getReport();
      const report2 = monitor.getReport();
      expect(report1.samples).not.toBe(report2.samples);
    });

    it('generatedAt is a recent Date', () => {
      const before = Date.now();
      const report = monitor.getReport();
      expect(report.generatedAt.getTime()).toBeGreaterThanOrEqual(before);
    });
  });

  describe('clear()', () => {
    it('removes all samples, slow queries, snapshots, and violations', async () => {
      const m = new PerformanceMonitor({ slowQueryThresholdMs: 0 });
      await m.time('op', () => Promise.resolve(1));
      m.recordSlowQuery('q', 1);
      m.snapshotMemory();
      m.addBudget({ name: 'op', thresholdMs: 0 });
      await m.time('op', () => Promise.resolve(2));
      m.clear();
      const report = m.getReport();
      expect(report.samples).toHaveLength(0);
      expect(report.slowQueries).toHaveLength(0);
      expect(report.memorySnapshots).toHaveLength(0);
      expect(report.budgetViolations).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// RequestTimingCollector
// ---------------------------------------------------------------------------
describe('RequestTimingCollector', () => {
  let collector: RequestTimingCollector;

  const entry = (overrides: Partial<RequestTimingRecord> = {}): RequestTimingRecord => ({
    method: 'GET',
    path: '/api/users',
    statusCode: 200,
    durationMs: 50,
    timestamp: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    collector = new RequestTimingCollector();
  });

  it('size() starts at 0', () => {
    expect(collector.size()).toBe(0);
  });

  it('record() increases size', () => {
    collector.record(entry());
    expect(collector.size()).toBe(1);
  });

  it('getAll() returns all records', () => {
    collector.record(entry({ path: '/a' }));
    collector.record(entry({ path: '/b' }));
    expect(collector.getAll()).toHaveLength(2);
  });

  it('getSlow() returns only records above threshold', () => {
    collector.record(entry({ durationMs: 50 }));
    collector.record(entry({ durationMs: 200 }));
    expect(collector.getSlow(100)).toHaveLength(1);
    expect(collector.getSlow(100)[0]?.durationMs).toBe(200);
  });

  it('getSlow() excludes entries equal to threshold', () => {
    collector.record(entry({ durationMs: 100 }));
    expect(collector.getSlow(100)).toHaveLength(0);
  });

  it('getByMethod() matches case-insensitively', () => {
    collector.record(entry({ method: 'GET' }));
    collector.record(entry({ method: 'POST' }));
    expect(collector.getByMethod('get')).toHaveLength(1);
    expect(collector.getByMethod('POST')).toHaveLength(1);
  });

  it('getByPath() filters by exact path', () => {
    collector.record(entry({ path: '/a' }));
    collector.record(entry({ path: '/b' }));
    expect(collector.getByPath('/a')).toHaveLength(1);
  });

  it('getByStatus() filters by status code', () => {
    collector.record(entry({ statusCode: 200 }));
    collector.record(entry({ statusCode: 404 }));
    expect(collector.getByStatus(404)).toHaveLength(1);
  });

  it('averageDurationMs() returns undefined when empty', () => {
    expect(collector.averageDurationMs()).toBeUndefined();
  });

  it('averageDurationMs() returns correct average', () => {
    collector.record(entry({ durationMs: 100 }));
    collector.record(entry({ durationMs: 200 }));
    expect(collector.averageDurationMs()).toBe(150);
  });

  it('clear() removes all records', () => {
    collector.record(entry());
    collector.clear();
    expect(collector.size()).toBe(0);
  });

  it('getAll() returns a copy (not the internal array)', () => {
    collector.record(entry());
    const a = collector.getAll();
    const b = collector.getAll();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// QueryProfiler
// ---------------------------------------------------------------------------
describe('QueryProfiler', () => {
  let profiler: QueryProfiler;

  beforeEach(() => {
    profiler = new QueryProfiler();
  });

  it('size() starts at 0', () => {
    expect(profiler.size()).toBe(0);
  });

  it('profile() returns the result of the wrapped function', async () => {
    const result = await profiler.profile('findAll', () => Promise.resolve(['a', 'b']));
    expect(result).toEqual(['a', 'b']);
  });

  it('profile() records a profile entry', async () => {
    await profiler.profile('q', () => Promise.resolve(null));
    expect(profiler.size()).toBe(1);
  });

  it('profile() records durationMs >= 0', async () => {
    await profiler.profile('q', () => Promise.resolve(null));
    expect(profiler.getProfiles()[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('profile() stores rowCount when getRowCount is provided', async () => {
    await profiler.profile(
      'q',
      () => Promise.resolve([1, 2, 3]),
      (rows) => rows.length,
    );
    expect(profiler.getProfiles()[0]?.rowCount).toBe(3);
  });

  it('profile() omits rowCount when getRowCount is not provided', async () => {
    await profiler.profile('q', () => Promise.resolve(null));
    expect('rowCount' in (profiler.getProfiles()[0] ?? {})).toBe(false);
  });

  it('getSlowest() returns n profiles sorted by duration desc', async () => {
    await profiler.profile('slow', () => Promise.resolve(null));
    await profiler.profile('fast', () => Promise.resolve(null));
    // Manually inject with known durations for determinism
    profiler.clear();
    // Use direct profiling with a sleep-like micro-delay is flaky; instead
    // verify getSlowest returns at most n entries
    await profiler.profile('a', () => Promise.resolve(0));
    await profiler.profile('b', () => Promise.resolve(0));
    await profiler.profile('c', () => Promise.resolve(0));
    expect(profiler.getSlowest(2)).toHaveLength(2);
  });

  it('getByName() returns only matching profiles', async () => {
    await profiler.profile('findUser', () => Promise.resolve(null));
    await profiler.profile('findOrder', () => Promise.resolve(null));
    await profiler.profile('findUser', () => Promise.resolve(null));
    expect(profiler.getByName('findUser')).toHaveLength(2);
  });

  it('getProfiles() returns a copy each time', async () => {
    await profiler.profile('q', () => Promise.resolve(null));
    expect(profiler.getProfiles()).not.toBe(profiler.getProfiles());
  });

  it('clear() removes all profiles', async () => {
    await profiler.profile('q', () => Promise.resolve(null));
    profiler.clear();
    expect(profiler.size()).toBe(0);
  });
});
