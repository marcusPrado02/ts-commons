/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
import { describe, it, expect, beforeEach } from 'vitest';
import { HeapSnapshotCollector } from './memory/HeapSnapshotCollector';
import { MemoryLeakDetector } from './memory/MemoryLeakDetector';
import { GcMetricsCollector } from './memory/GcMetricsCollector';
import { MemoryAlertManager } from './memory/MemoryAlertManager';
import type { HeapSnapshot, GcEvent } from './memory/MemoryTypes';
import type { AlertSnapshot } from './memory/MemoryAlertManager';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeSnapshot(heapUsed: number, label?: string): HeapSnapshot {
  return {
    capturedAt: new Date(),
    heapUsedBytes: heapUsed,
    heapTotalBytes: heapUsed * 2,
    externalBytes: 1024,
    arrayBuffersBytes: 512,
    ...(label !== undefined ? { label } : {}),
  };
}

function makeAlertSnapshot(heapUsed: number, rss?: number): AlertSnapshot {
  return {
    capturedAt: new Date(),
    heapUsedBytes: heapUsed,
    heapTotalBytes: heapUsed * 2,
    externalBytes: 256,
    arrayBuffersBytes: 128,
    ...(rss !== undefined ? { rssBytes: rss } : {}),
  };
}

function makeGcEvent(type: GcEvent['type'], durationMs: number, reclaimedBytes = 1024): GcEvent {
  return { occurredAt: new Date(), durationMs, type, reclaimedBytes };
}

// ─── HeapSnapshotCollector ───────────────────────────────────────────────────

describe('HeapSnapshotCollector', () => {
  let collector: HeapSnapshotCollector;

  beforeEach(() => {
    collector = new HeapSnapshotCollector();
  });

  it('starts empty', () => {
    expect(collector.snapshotCount()).toBe(0);
    expect(collector.getAll()).toHaveLength(0);
  });

  it('capture() stores a snapshot', () => {
    collector.capture(makeSnapshot(1000));
    expect(collector.snapshotCount()).toBe(1);
  });

  it('latest() returns the most recent snapshot', () => {
    collector.capture(makeSnapshot(1000));
    collector.capture(makeSnapshot(2000));
    expect(collector.latest()?.heapUsedBytes).toBe(2000);
  });

  it('latest() returns undefined when empty', () => {
    expect(collector.latest()).toBeUndefined();
  });

  it('peak() returns snapshot with highest heapUsedBytes', () => {
    collector.capture(makeSnapshot(3000));
    collector.capture(makeSnapshot(1000));
    collector.capture(makeSnapshot(2000));
    expect(collector.peak()?.heapUsedBytes).toBe(3000);
  });

  it('peak() returns undefined when empty', () => {
    expect(collector.peak()).toBeUndefined();
  });

  it('getAll() returns copies in insertion order', () => {
    collector.capture(makeSnapshot(100));
    collector.capture(makeSnapshot(200));
    const all = collector.getAll();
    expect(all[0]?.heapUsedBytes).toBe(100);
    expect(all[1]?.heapUsedBytes).toBe(200);
  });

  it('diffs() returns empty array when fewer than 2 snapshots', () => {
    collector.capture(makeSnapshot(1000));
    expect(collector.diffs()).toHaveLength(0);
  });

  it('diffs() computes delta between consecutive snapshots', () => {
    collector.capture(makeSnapshot(1000));
    collector.capture(makeSnapshot(1500));
    const diffs = collector.diffs();
    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.heapDeltaBytes).toBe(500);
  });

  it('diffs() handles negative deltas (GC freed memory)', () => {
    collector.capture(makeSnapshot(2000));
    collector.capture(makeSnapshot(1000));
    expect(collector.diffs()[0]?.heapDeltaBytes).toBe(-1000);
  });

  it('totalHeapGrowthBytes() returns 0 with a single snapshot', () => {
    collector.capture(makeSnapshot(5000));
    expect(collector.totalHeapGrowthBytes()).toBe(0);
  });

  it('totalHeapGrowthBytes() computes growth from first to last', () => {
    collector.capture(makeSnapshot(1000));
    collector.capture(makeSnapshot(3000));
    expect(collector.totalHeapGrowthBytes()).toBe(2000);
  });

  it('clear() removes all stored snapshots', () => {
    collector.capture(makeSnapshot(1000));
    collector.clear();
    expect(collector.snapshotCount()).toBe(0);
    expect(collector.latest()).toBeUndefined();
  });

  it('stores snapshots with optional label', () => {
    collector.capture(makeSnapshot(1000, 'after-warmup'));
    expect(collector.latest()?.label).toBe('after-warmup');
  });

  it('peak() works correctly with a single snapshot', () => {
    collector.capture(makeSnapshot(42));
    expect(collector.peak()?.heapUsedBytes).toBe(42);
  });

  it('diffs() returns n-1 entries for n snapshots', () => {
    for (let i = 0; i < 5; i++) collector.capture(makeSnapshot(i * 100));
    expect(collector.diffs()).toHaveLength(4);
  });
});

// ─── MemoryLeakDetector ──────────────────────────────────────────────────────

describe('MemoryLeakDetector', () => {
  let detector: MemoryLeakDetector;

  beforeEach(() => {
    detector = new MemoryLeakDetector(1000); // 1 KB threshold for tests
  });

  it('starts with no leaks', () => {
    expect(detector.hasLeaks()).toBe(false);
    expect(detector.leakCount()).toBe(0);
  });

  it('stores default threshold when none provided', () => {
    const d = new MemoryLeakDetector();
    expect(d.getGrowthThresholdBytes()).toBe(5 * 1024 * 1024);
  });

  it('getGrowthThresholdBytes() returns provided value', () => {
    expect(detector.getGrowthThresholdBytes()).toBe(1000);
  });

  it('does not detect leak with fewer than 3 observations', () => {
    detector.observe(makeSnapshot(1000));
    detector.observe(makeSnapshot(2000));
    expect(detector.hasLeaks()).toBe(false);
  });

  it('detects a leak when heap grows consistently above threshold', () => {
    detector.observe(makeSnapshot(1000));
    detector.observe(makeSnapshot(2000));
    detector.observe(makeSnapshot(3000));
    expect(detector.hasLeaks()).toBe(true);
  });

  it('does not detect a leak when growth is below threshold', () => {
    detector.observe(makeSnapshot(1000));
    detector.observe(makeSnapshot(1100));
    detector.observe(makeSnapshot(1200)); // only 200 bytes total growth
    expect(detector.hasLeaks()).toBe(false);
  });

  it('does not detect a leak when growth is not consistent', () => {
    detector.observe(makeSnapshot(3000));
    detector.observe(makeSnapshot(1000)); // drops
    detector.observe(makeSnapshot(2000));
    expect(detector.hasLeaks()).toBe(false);
  });

  it('getLeaks() returns copies of all recorded leak events', () => {
    detector.observe(makeSnapshot(1000));
    detector.observe(makeSnapshot(2000));
    detector.observe(makeSnapshot(3000));
    const leaks = detector.getLeaks();
    expect(leaks).toHaveLength(detector.leakCount());
  });

  it('leak record contains a message and growthBytes', () => {
    detector.observe(makeSnapshot(0));
    detector.observe(makeSnapshot(1500));
    detector.observe(makeSnapshot(3000));
    const leak = detector.getLeaks()[0];
    expect(leak?.growthBytes).toBe(3000);
    expect(typeof leak?.message).toBe('string');
  });

  it('observationCount() tracks total observations', () => {
    detector.observe(makeSnapshot(100));
    detector.observe(makeSnapshot(200));
    expect(detector.observationCount()).toBe(2);
  });

  it('clear() resets observations and leaks', () => {
    detector.observe(makeSnapshot(0));
    detector.observe(makeSnapshot(2000));
    detector.observe(makeSnapshot(5000));
    detector.clear();
    expect(detector.hasLeaks()).toBe(false);
    expect(detector.observationCount()).toBe(0);
  });

  it('multiple leak events can accumulate', () => {
    for (let i = 0; i < 6; i++) detector.observe(makeSnapshot(i * 2000));
    expect(detector.leakCount()).toBeGreaterThan(0);
  });

  it('leak record snapshotCount matches total observations at detection time', () => {
    detector.observe(makeSnapshot(0));
    detector.observe(makeSnapshot(2000));
    detector.observe(makeSnapshot(4000));
    const leak = detector.getLeaks()[0];
    expect(leak?.snapshotCount).toBe(3);
  });
});

// ─── GcMetricsCollector ──────────────────────────────────────────────────────

describe('GcMetricsCollector', () => {
  let gc: GcMetricsCollector;

  beforeEach(() => {
    gc = new GcMetricsCollector();
  });

  it('starts empty', () => {
    expect(gc.eventCount()).toBe(0);
  });

  it('stats() returns zero values when no events', () => {
    const s = gc.stats();
    expect(s.totalEvents).toBe(0);
    expect(s.avgDurationMs).toBe(0);
  });

  it('record() stores an event', () => {
    gc.record(makeGcEvent('minor', 5));
    expect(gc.eventCount()).toBe(1);
  });

  it('stats() totals duration and reclaimed bytes', () => {
    gc.record(makeGcEvent('minor', 5, 100));
    gc.record(makeGcEvent('major', 20, 500));
    const s = gc.stats();
    expect(s.totalDurationMs).toBe(25);
    expect(s.totalReclaimedBytes).toBe(600);
  });

  it('stats() computes average duration', () => {
    gc.record(makeGcEvent('minor', 10));
    gc.record(makeGcEvent('minor', 20));
    expect(gc.stats().avgDurationMs).toBe(15);
  });

  it('stats() counts events by type', () => {
    gc.record(makeGcEvent('major', 30));
    gc.record(makeGcEvent('minor', 5));
    gc.record(makeGcEvent('incremental', 2));
    const s = gc.stats();
    expect(s.majorCount).toBe(1);
    expect(s.minorCount).toBe(1);
    expect(s.incrementalCount).toBe(1);
  });

  it('getByType() filters events correctly', () => {
    gc.record(makeGcEvent('major', 30));
    gc.record(makeGcEvent('minor', 5));
    expect(gc.getByType('major')).toHaveLength(1);
    expect(gc.getByType('minor')).toHaveLength(1);
    expect(gc.getByType('incremental')).toHaveLength(0);
  });

  it('longestEvent() returns the event with highest durationMs', () => {
    gc.record(makeGcEvent('minor', 5));
    gc.record(makeGcEvent('major', 100));
    gc.record(makeGcEvent('incremental', 2));
    expect(gc.longestEvent()?.durationMs).toBe(100);
  });

  it('longestEvent() returns undefined when empty', () => {
    expect(gc.longestEvent()).toBeUndefined();
  });

  it('gcPressureRatio() returns 0 with fewer than 2 events', () => {
    gc.record(makeGcEvent('minor', 5));
    expect(gc.gcPressureRatio()).toBe(0);
  });

  it('gcPressureRatio() returns a value in [0, 1] for normal workloads', () => {
    const t0 = new Date(0);
    const t1 = new Date(1000);
    gc.record({ occurredAt: t0, durationMs: 10, type: 'minor', reclaimedBytes: 100 });
    gc.record({ occurredAt: t1, durationMs: 10, type: 'minor', reclaimedBytes: 100 });
    const ratio = gc.gcPressureRatio();
    expect(ratio).toBeGreaterThanOrEqual(0);
    expect(ratio).toBeLessThanOrEqual(1);
  });

  it('getAll() returns copies', () => {
    gc.record(makeGcEvent('minor', 5));
    const all = gc.getAll();
    expect(all).toHaveLength(1);
  });

  it('clear() removes all events', () => {
    gc.record(makeGcEvent('major', 20));
    gc.clear();
    expect(gc.eventCount()).toBe(0);
    expect(gc.stats().totalEvents).toBe(0);
  });

  it('stats() totalEvents matches eventCount()', () => {
    gc.record(makeGcEvent('minor', 5));
    gc.record(makeGcEvent('minor', 5));
    expect(gc.stats().totalEvents).toBe(gc.eventCount());
  });
});

// ─── MemoryAlertManager ──────────────────────────────────────────────────────

describe('MemoryAlertManager', () => {
  let manager: MemoryAlertManager;

  beforeEach(() => {
    manager = new MemoryAlertManager();
  });

  it('starts with no rules and no alerts', () => {
    expect(manager.ruleCount()).toBe(0);
    expect(manager.alertCount()).toBe(0);
  });

  it('addRule() stores a rule', () => {
    manager.addRule({ name: 'heap-high', thresholdBytes: 100, metric: 'heapUsed' });
    expect(manager.ruleCount()).toBe(1);
    expect(manager.hasRule('heap-high')).toBe(true);
  });

  it('removeRule() deletes the rule and returns true', () => {
    manager.addRule({ name: 'r', thresholdBytes: 100, metric: 'heapUsed' });
    expect(manager.removeRule('r')).toBe(true);
    expect(manager.hasRule('r')).toBe(false);
  });

  it('removeRule() returns false for unknown rule', () => {
    expect(manager.removeRule('missing')).toBe(false);
  });

  it('getRules() returns copies of all rules', () => {
    manager.addRule({ name: 'r', thresholdBytes: 50, metric: 'heapTotal' });
    const rules = manager.getRules();
    expect(rules).toHaveLength(1);
    expect(rules[0]?.name).toBe('r');
  });

  it('evaluate() fires an alert when heapUsed exceeds threshold', () => {
    manager.addRule({ name: 'heap', thresholdBytes: 500, metric: 'heapUsed' });
    manager.evaluate(makeAlertSnapshot(600));
    expect(manager.alertCount()).toBe(1);
  });

  it('evaluate() does not fire when heapUsed is below threshold', () => {
    manager.addRule({ name: 'heap', thresholdBytes: 500, metric: 'heapUsed' });
    manager.evaluate(makeAlertSnapshot(400));
    expect(manager.alertCount()).toBe(0);
  });

  it('evaluate() fires alert for heapTotal metric', () => {
    manager.addRule({ name: 'total', thresholdBytes: 500, metric: 'heapTotal' });
    manager.evaluate(makeAlertSnapshot(300)); // heapTotal = 600
    expect(manager.alertCount()).toBe(1);
  });

  it('evaluate() fires alert for external metric', () => {
    manager.addRule({ name: 'ext', thresholdBytes: 100, metric: 'external' });
    manager.evaluate(makeAlertSnapshot(1000)); // externalBytes = 256
    expect(manager.alertCount()).toBe(1);
  });

  it('evaluate() fires alert for rss metric', () => {
    manager.addRule({ name: 'rss', thresholdBytes: 100, metric: 'rss' });
    manager.evaluate(makeAlertSnapshot(1000, 200));
    expect(manager.alertCount()).toBe(1);
  });

  it('evaluate() uses 0 for rss when not provided', () => {
    manager.addRule({ name: 'rss', thresholdBytes: 100, metric: 'rss' });
    manager.evaluate(makeAlertSnapshot(1000)); // no rssBytes → 0
    expect(manager.alertCount()).toBe(0);
  });

  it('alert contains correct threshold, actual, and overage values', () => {
    manager.addRule({ name: 'heap', thresholdBytes: 500, metric: 'heapUsed' });
    manager.evaluate(makeAlertSnapshot(700));
    const alert = manager.getAlerts()[0];
    expect(alert?.thresholdBytes).toBe(500);
    expect(alert?.actualBytes).toBe(700);
    expect(alert?.overageBytes).toBe(200);
  });

  it('getAlertsByRule() filters by rule name', () => {
    manager.addRule({ name: 'a', thresholdBytes: 100, metric: 'heapUsed' });
    manager.addRule({ name: 'b', thresholdBytes: 100, metric: 'heapUsed' });
    manager.evaluate(makeAlertSnapshot(200));
    expect(manager.getAlertsByRule('a')).toHaveLength(1);
    expect(manager.getAlertsByRule('b')).toHaveLength(1);
  });

  it('hasAlerts() returns false when no alerts fired', () => {
    expect(manager.hasAlerts()).toBe(false);
  });

  it('clearAlerts() empties alerts but keeps rules', () => {
    manager.addRule({ name: 'r', thresholdBytes: 100, metric: 'heapUsed' });
    manager.evaluate(makeAlertSnapshot(200));
    manager.clearAlerts();
    expect(manager.alertCount()).toBe(0);
    expect(manager.ruleCount()).toBe(1);
  });

  it('clear() removes both rules and alerts', () => {
    manager.addRule({ name: 'r', thresholdBytes: 100, metric: 'heapUsed' });
    manager.evaluate(makeAlertSnapshot(200));
    manager.clear();
    expect(manager.ruleCount()).toBe(0);
    expect(manager.alertCount()).toBe(0);
  });

  it('multiple evaluate calls accumulate alerts', () => {
    manager.addRule({ name: 'r', thresholdBytes: 100, metric: 'heapUsed' });
    manager.evaluate(makeAlertSnapshot(200));
    manager.evaluate(makeAlertSnapshot(300));
    expect(manager.alertCount()).toBe(2);
  });
});
