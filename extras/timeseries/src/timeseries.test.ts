/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import {
  InfluxDBAdapter,
  TimescaleDBAdapter,
  TimeBucketer,
  AggregationEngine,
  Downsampler,
  RetentionPolicyManager,
} from './index.js';
import type { DataPoint, RetentionPolicy, TSQueryExecutor } from './index.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeExecutor(returnRows: Record<string, unknown>[] = []): TSQueryExecutor {
  return vi.fn().mockResolvedValue(returnRows);
}

function makePoint(
  measurement: string,
  timestamp: number,
  fields: Record<string, number | string | boolean> = { value: 1 },
  tags?: Record<string, string>,
): DataPoint {
  const p: DataPoint = { timestamp, measurement, fields };
  if (tags !== undefined) p.tags = tags;
  return p;
}

// ─── InfluxDBAdapter ──────────────────────────────────────────────────────────

describe('InfluxDBAdapter', () => {
  const cfg = { org: 'myorg', bucket: 'mybucket', executor: makeExecutor() };

  it('type is "influxdb"', () => {
    expect(new InfluxDBAdapter(cfg).type).toBe('influxdb');
  });

  it('write() returns 0 and does not call executor for empty array', async () => {
    const executor = makeExecutor();
    const a = new InfluxDBAdapter({ ...cfg, executor });
    expect(await a.write([])).toBe(0);
    expect(executor).not.toHaveBeenCalled();
  });

  it('write() returns point count', async () => {
    const executor = makeExecutor();
    const a = new InfluxDBAdapter({ ...cfg, executor });
    expect(await a.write([makePoint('cpu', 1000), makePoint('cpu', 2000)])).toBe(2);
  });

  it('write() includes measurement in line protocol', async () => {
    const executor = makeExecutor();
    const a = new InfluxDBAdapter({ ...cfg, executor });
    await a.write([makePoint('cpu', 1000, { usage: 0.5 })]);
    const query = (executor as any).mock.calls[0]![0] as string;
    expect(query).toContain('cpu');
    expect(query).toContain('usage=0.5');
    expect(query).toContain('1000');
  });

  it('write() includes tags in line protocol', async () => {
    const executor = makeExecutor();
    const a = new InfluxDBAdapter({ ...cfg, executor });
    await a.write([makePoint('cpu', 1000, { v: 1 }, { host: 'web01' })]);
    const query = (executor as any).mock.calls[0]![0] as string;
    expect(query).toContain('host=web01');
  });

  it('write() wraps string field values in quotes', async () => {
    const executor = makeExecutor();
    const a = new InfluxDBAdapter({ ...cfg, executor });
    await a.write([makePoint('events', 1000, { label: 'hello' })]);
    const query = (executor as any).mock.calls[0]![0] as string;
    expect(query).toContain('"hello"');
  });

  it('query() calls executor with flux from() syntax', async () => {
    const executor = makeExecutor();
    const a = new InfluxDBAdapter({ ...cfg, executor });
    await a.query('cpu', { start: 1000, end: 2000 });
    const query = (executor as any).mock.calls[0]![0] as string;
    expect(query).toContain('from(bucket:"mybucket")');
    expect(query).toContain('range(start:1000,stop:2000)');
    expect(query).toContain('_measurement == "cpu"');
  });

  it('query() adds tag filters to flux pipeline', async () => {
    const executor = makeExecutor();
    const a = new InfluxDBAdapter({ ...cfg, executor });
    await a.query('cpu', { start: 0, end: 1 }, { host: 'web01' });
    const query = (executor as any).mock.calls[0]![0] as string;
    expect(query).toContain('host == "web01"');
  });

  it('query() maps executor rows to DataPoints', async () => {
    const executor = makeExecutor([{ _time: 1000, _measurement: 'cpu', usage: 0.9 }]);
    const a = new InfluxDBAdapter({ ...cfg, executor });
    const points = await a.query('cpu', { start: 0, end: 9999 });
    expect(points).toHaveLength(1);
    expect(points[0]?.timestamp).toBe(1000);
    expect(points[0]?.measurement).toBe('cpu');
    expect(points[0]?.fields['usage']).toBe(0.9);
  });

  it('query() maps tag__ prefixed keys to tags object', async () => {
    const executor = makeExecutor([
      { _time: 1000, _measurement: 'cpu', tag_host: 'web01', usage: 0.5 },
    ]);
    const a = new InfluxDBAdapter({ ...cfg, executor });
    const points = await a.query('cpu', { start: 0, end: 9999 });
    expect(points[0]?.tags?.['host']).toBe('web01');
  });

  it('deleteMeasurement() calls executor with DELETE FROM', async () => {
    const executor = makeExecutor();
    const a = new InfluxDBAdapter({ ...cfg, executor });
    await a.deleteMeasurement('cpu');
    const query = (executor as any).mock.calls[0]![0] as string;
    expect(query).toContain('DELETE FROM');
    expect(query).toContain('"cpu"');
  });

  it('applyRetentionPolicy() calls executor with time threshold', async () => {
    const executor = makeExecutor([]);
    const a = new InfluxDBAdapter({ ...cfg, executor });
    const policy: RetentionPolicy = { name: '30d', measurement: 'cpu', durationMs: 1000 };
    const before = Date.now();
    await a.applyRetentionPolicy(policy);
    const after = Date.now();
    const query = (executor as any).mock.calls[0]![0] as string;
    expect(query).toContain('"cpu"');
    const match = /time < (\d+)/.exec(query);
    const threshold = Number(match?.[1]);
    expect(threshold).toBeGreaterThanOrEqual(before - 1000);
    expect(threshold).toBeLessThanOrEqual(after - 1000 + 10);
  });

  it('applyRetentionPolicy() returns deletedCount from rows[0].deleted when present', async () => {
    const executor = makeExecutor([{ deleted: 42 }]);
    const a = new InfluxDBAdapter({ ...cfg, executor });
    const policy: RetentionPolicy = { name: '7d', measurement: 'mem', durationMs: 0 };
    const result = await a.applyRetentionPolicy(policy);
    expect(result.deletedCount).toBe(42);
  });

  it('applyRetentionPolicy() falls back to rows.length when deleted field absent', async () => {
    const executor = makeExecutor([{}, {}, {}]);
    const a = new InfluxDBAdapter({ ...cfg, executor });
    const policy: RetentionPolicy = { name: '7d', measurement: 'mem', durationMs: 0 };
    const result = await a.applyRetentionPolicy(policy);
    expect(result.deletedCount).toBe(3);
  });
});

// ─── TimescaleDBAdapter ───────────────────────────────────────────────────────

describe('TimescaleDBAdapter', () => {
  const cfg = { schema: 'public', executor: makeExecutor() };

  it('type is "timescaledb"', () => {
    expect(new TimescaleDBAdapter(cfg).type).toBe('timescaledb');
  });

  it('qualifyTable() returns schema.measurement', () => {
    const a = new TimescaleDBAdapter(cfg);
    expect(a.qualifyTable('cpu')).toBe('public.cpu');
  });

  it('write() returns 0 for empty array', async () => {
    const executor = makeExecutor();
    const a = new TimescaleDBAdapter({ ...cfg, executor });
    expect(await a.write([])).toBe(0);
    expect(executor).not.toHaveBeenCalled();
  });

  it('write() returns point count', async () => {
    const executor = makeExecutor();
    const a = new TimescaleDBAdapter({ ...cfg, executor });
    expect(await a.write([makePoint('cpu', 1000), makePoint('cpu', 2000)])).toBe(2);
  });

  it('write() calls executor once per point with INSERT SQL', async () => {
    const executor = makeExecutor();
    const a = new TimescaleDBAdapter({ ...cfg, executor });
    await a.write([makePoint('cpu', 1000), makePoint('mem', 2000)]);
    expect(executor).toHaveBeenCalledTimes(2);
    const sql = (executor as any).mock.calls[0]![0] as string;
    expect(sql).toContain('INSERT INTO public.cpu');
    expect(sql).toContain('$1');
  });

  it('query() builds SELECT with time range', async () => {
    const executor = makeExecutor([]);
    const a = new TimescaleDBAdapter({ ...cfg, executor });
    await a.query('cpu', { start: 100, end: 200 });
    const sql = (executor as any).mock.calls[0]![0] as string;
    const params = (executor as any).mock.calls[0]![1] as unknown[];
    expect(sql).toContain('SELECT time, tags, fields FROM public.cpu');
    expect(sql).toContain('time >= $1');
    expect(sql).toContain('time <= $2');
    expect(params[0]).toBe(100);
    expect(params[1]).toBe(200);
  });

  it('query() adds tag filter for each tag', async () => {
    const executor = makeExecutor([]);
    const a = new TimescaleDBAdapter({ ...cfg, executor });
    await a.query('cpu', { start: 0, end: 1 }, { host: 'web01' });
    const sql = (executor as any).mock.calls[0]![0] as string;
    expect(sql).toContain("tags->>'host' = $3");
  });

  it('query() maps rows with JSON strings to DataPoints', async () => {
    const executor = makeExecutor([
      { time: 1000, tags: '{"host":"web01"}', fields: '{"cpu":0.8}' },
    ]);
    const a = new TimescaleDBAdapter({ ...cfg, executor });
    const points = await a.query('cpu', { start: 0, end: 9999 });
    expect(points[0]?.timestamp).toBe(1000);
    expect(points[0]?.fields['cpu']).toBe(0.8);
    expect(points[0]?.tags?.['host']).toBe('web01');
  });

  it('query() maps rows with object tags/fields to DataPoints', async () => {
    const executor = makeExecutor([{ time: 2000, tags: { env: 'prod' }, fields: { mem: 512 } }]);
    const a = new TimescaleDBAdapter({ ...cfg, executor });
    const points = await a.query('mem', { start: 0, end: 9999 });
    expect(points[0]?.fields['mem']).toBe(512);
    expect(points[0]?.tags?.['env']).toBe('prod');
  });

  it('deleteMeasurement() generates DROP TABLE IF EXISTS', async () => {
    const executor = makeExecutor();
    const a = new TimescaleDBAdapter({ ...cfg, executor });
    await a.deleteMeasurement('cpu');
    const sql = (executor as any).mock.calls[0]![0] as string;
    expect(sql).toContain('DROP TABLE IF EXISTS public.cpu');
  });

  it('applyRetentionPolicy() generates DELETE WHERE time < threshold', async () => {
    const executor = makeExecutor([]);
    const a = new TimescaleDBAdapter({ ...cfg, executor });
    const policy: RetentionPolicy = { name: '7d', measurement: 'cpu', durationMs: 1000 };
    const before = Date.now();
    await a.applyRetentionPolicy(policy);
    const after = Date.now();
    const sql = (executor as any).mock.calls[0]![0] as string;
    const params = (executor as any).mock.calls[0]![1] as number[];
    expect(sql).toContain('DELETE FROM public.cpu');
    expect(sql).toContain('time < $1');
    expect(params[0]).toBeGreaterThanOrEqual(before - 1000);
    expect(params[0]).toBeLessThanOrEqual(after - 1000 + 10);
  });

  it('applyRetentionPolicy() returns deletedCount = rows.length', async () => {
    const executor = makeExecutor([{}, {}, {}]);
    const a = new TimescaleDBAdapter({ ...cfg, executor });
    const policy: RetentionPolicy = { name: '7d', measurement: 'cpu', durationMs: 0 };
    const result = await a.applyRetentionPolicy(policy);
    expect(result.deletedCount).toBe(3);
    expect(result.policy).toBe(policy);
  });
});

// ─── TimeBucketer ─────────────────────────────────────────────────────────────

describe('TimeBucketer', () => {
  const bucketer = new TimeBucketer();

  const points = [
    makePoint('cpu', 0), // minute 0
    makePoint('cpu', 30_000), // minute 0
    makePoint('cpu', 60_000), // minute 1
    makePoint('cpu', 90_000), // minute 1
    makePoint('cpu', 120_000), // minute 2
  ];

  it('bucket() groups by minute', () => {
    const buckets = bucketer.bucket(points, 'minute');
    expect(buckets).toHaveLength(3);
    expect(buckets[0]?.points).toHaveLength(2);
    expect(buckets[1]?.points).toHaveLength(2);
    expect(buckets[2]?.points).toHaveLength(1);
  });

  it('bucket() groups by hour', () => {
    const pts = [
      makePoint('cpu', 0),
      makePoint('cpu', 1_800_000), // same hour
      makePoint('cpu', 3_600_000), // next hour
    ];
    const buckets = bucketer.bucket(pts, 'hour');
    expect(buckets).toHaveLength(2);
    expect(buckets[0]?.points).toHaveLength(2);
  });

  it('bucket() groups by day', () => {
    const pts = [
      makePoint('cpu', 0),
      makePoint('cpu', 43_200_000), // same day
      makePoint('cpu', 86_400_000), // next day
    ];
    const buckets = bucketer.bucket(pts, 'day');
    expect(buckets).toHaveLength(2);
    expect(buckets[0]?.points).toHaveLength(2);
  });

  it('bucket() groups by week', () => {
    const week = 7 * 86_400_000;
    const pts = [
      makePoint('cpu', 0),
      makePoint('cpu', week - 1), // same week
      makePoint('cpu', week), // next week
    ];
    const buckets = bucketer.bucket(pts, 'week');
    expect(buckets).toHaveLength(2);
  });

  it('bucket() groups by month', () => {
    const jan = Date.UTC(2024, 0, 15);
    const feb = Date.UTC(2024, 1, 15);
    const pts = [makePoint('cpu', jan), makePoint('cpu', feb)];
    const buckets = bucketer.bucket(pts, 'month');
    expect(buckets).toHaveLength(2);
  });

  it('bucket() returns buckets in chronological order', () => {
    // Provide points out of order
    const shuffled = [points[4]!, points[0]!, points[2]!];
    const buckets = bucketer.bucket(shuffled, 'minute');
    const timestamps = buckets.map((b) => b.timestamp);
    expect(timestamps).toStrictEqual([...timestamps].sort((a, b) => a - b));
  });

  it('bucket() attaches interval to each bucket', () => {
    const buckets = bucketer.bucket(points, 'hour');
    expect(buckets.every((b) => b.interval === 'hour')).toBe(true);
  });

  it('bucket() returns empty array for empty input', () => {
    expect(bucketer.bucket([], 'minute')).toStrictEqual([]);
  });

  it('getBucketStart() aligns to minute boundary', () => {
    expect(bucketer.getBucketStart(75_000, 'minute')).toBe(60_000);
  });

  it('getBucketStart() aligns to hour boundary', () => {
    expect(bucketer.getBucketStart(5_400_000, 'hour')).toBe(3_600_000);
  });

  it('getBucketStart() aligns to month start', () => {
    const ts = Date.UTC(2024, 2, 15, 12, 0, 0); // Mar 15 UTC
    const start = bucketer.getBucketStart(ts, 'month');
    expect(start).toBe(Date.UTC(2024, 2, 1));
  });
});

// ─── AggregationEngine ────────────────────────────────────────────────────────

describe('AggregationEngine', () => {
  const engine = new AggregationEngine();
  const range = { start: 0, end: 1000 };

  const points = [
    makePoint('cpu', 100, { value: 10 }),
    makePoint('cpu', 200, { value: 20 }),
    makePoint('cpu', 300, { value: 30 }),
  ];

  it('aggregate() sum returns total', () => {
    expect(engine.aggregate(points, 'value', 'sum', range).value).toBe(60);
  });

  it('aggregate() avg returns arithmetic mean', () => {
    expect(engine.aggregate(points, 'value', 'avg', range).value).toBe(20);
  });

  it('aggregate() min returns minimum', () => {
    expect(engine.aggregate(points, 'value', 'min', range).value).toBe(10);
  });

  it('aggregate() max returns maximum', () => {
    expect(engine.aggregate(points, 'value', 'max', range).value).toBe(30);
  });

  it('aggregate() count returns number of numeric values', () => {
    expect(engine.aggregate(points, 'value', 'count', range).value).toBe(3);
  });

  it('aggregate() stddev > 0 for distinct values', () => {
    expect(engine.aggregate(points, 'value', 'stddev', range).value).toBeGreaterThan(0);
  });

  it('aggregate() stddev = 0 for identical values', () => {
    const uniform = [makePoint('cpu', 100, { v: 5 }), makePoint('cpu', 200, { v: 5 })];
    expect(engine.aggregate(uniform, 'v', 'stddev', range).value).toBe(0);
  });

  it('aggregate() skips non-numeric field values', () => {
    const mixed = [makePoint('cpu', 100, { v: 10 }), makePoint('cpu', 200, { v: 'not-a-number' })];
    expect(engine.aggregate(mixed, 'v', 'sum', range).value).toBe(10);
  });

  it('aggregate() returns 0 for empty points sum', () => {
    expect(engine.aggregate([], 'v', 'sum', range).value).toBe(0);
  });

  it('aggregate() result contains measurement, field, and fn', () => {
    const result = engine.aggregate(points, 'value', 'avg', range);
    expect(result.measurement).toBe('cpu');
    expect(result.field).toBe('value');
    expect(result.fn).toBe('avg');
  });

  it('aggregate() attaches provided range to result', () => {
    const r = { start: 100, end: 300 };
    const result = engine.aggregate(points, 'value', 'sum', r);
    expect(result.range).toStrictEqual(r);
  });
});

// ─── Downsampler ──────────────────────────────────────────────────────────────

describe('Downsampler', () => {
  const ds = new Downsampler();

  function series(n: number): DataPoint[] {
    return Array.from({ length: n }, (_, i) => makePoint('cpu', i * 1000, { v: i * 2 }));
  }

  describe('mean algorithm', () => {
    it('returns original points when count <= targetPoints', () => {
      const pts = series(5);
      const result = ds.downsample(pts, 'v', { algorithm: 'mean', targetPoints: 5 });
      expect(result).toHaveLength(5);
    });

    it('output length equals targetPoints', () => {
      const pts = series(100);
      const result = ds.downsample(pts, 'v', { algorithm: 'mean', targetPoints: 10 });
      expect(result).toHaveLength(10);
    });

    it('each bucket contains averaged values', () => {
      // 4 points → 2 buckets → bucket0: pts[0,1], bucket1: pts[2,3]
      const pts = [
        makePoint('cpu', 0, { v: 10 }),
        makePoint('cpu', 1000, { v: 20 }),
        makePoint('cpu', 2000, { v: 30 }),
        makePoint('cpu', 3000, { v: 40 }),
      ];
      const result = ds.downsample(pts, 'v', { algorithm: 'mean', targetPoints: 2 });
      expect(result[0]?.fields['v']).toBe(15);
      expect(result[1]?.fields['v']).toBe(35);
    });
  });

  describe('lttb algorithm', () => {
    it('returns original points when count <= targetPoints', () => {
      const pts = series(3);
      const result = ds.downsample(pts, 'v', { algorithm: 'lttb', targetPoints: 5 });
      expect(result).toHaveLength(3);
    });

    it('output length equals targetPoints', () => {
      const pts = series(100);
      const result = ds.downsample(pts, 'v', { algorithm: 'lttb', targetPoints: 10 });
      expect(result).toHaveLength(10);
    });

    it('preserves first point', () => {
      const pts = series(20);
      const result = ds.downsample(pts, 'v', { algorithm: 'lttb', targetPoints: 5 });
      expect(result[0]).toStrictEqual(pts[0]);
    });

    it('preserves last point', () => {
      const pts = series(20);
      const result = ds.downsample(pts, 'v', { algorithm: 'lttb', targetPoints: 5 });
      expect(result[result.length - 1]).toStrictEqual(pts[pts.length - 1]);
    });

    it('selected points come from original array', () => {
      const pts = series(30);
      const result = ds.downsample(pts, 'v', { algorithm: 'lttb', targetPoints: 6 });
      for (const r of result) {
        expect(pts.some((p) => p.timestamp === r.timestamp)).toBe(true);
      }
    });
  });
});

// ─── RetentionPolicyManager ───────────────────────────────────────────────────

describe('RetentionPolicyManager', () => {
  function makeAdapter(deletedCount = 0) {
    return {
      type: 'mock',
      write: vi.fn(),
      query: vi.fn(),
      deleteMeasurement: vi.fn(),
      applyRetentionPolicy: vi.fn().mockImplementation(async (policy: RetentionPolicy) => ({
        policy,
        deletedCount,
      })),
    };
  }

  it('register() adds policies', () => {
    const mgr = new RetentionPolicyManager();
    const p: RetentionPolicy = { name: '30d', measurement: 'cpu', durationMs: 30 * 86_400_000 };
    mgr.register(p);
    expect(mgr.get('30d')).toBe(p);
  });

  it('register() overwrites existing policy with same name', () => {
    const mgr = new RetentionPolicyManager();
    const p1: RetentionPolicy = { name: 'p', measurement: 'a', durationMs: 1 };
    const p2: RetentionPolicy = { name: 'p', measurement: 'b', durationMs: 2 };
    mgr.register(p1);
    mgr.register(p2);
    expect(mgr.get('p')).toBe(p2);
  });

  it('list() returns all policies', () => {
    const mgr = new RetentionPolicyManager();
    const p1: RetentionPolicy = { name: 'a', measurement: 'cpu', durationMs: 1_000 };
    const p2: RetentionPolicy = { name: 'b', measurement: 'mem', durationMs: 2_000 };
    mgr.register(p1);
    mgr.register(p2);
    expect(mgr.list()).toStrictEqual([p1, p2]);
  });

  it('list() returns empty array when no policies', () => {
    expect(new RetentionPolicyManager().list()).toStrictEqual([]);
  });

  it('get() returns undefined for unknown name', () => {
    expect(new RetentionPolicyManager().get('nope')).toBeUndefined();
  });

  it('remove() deletes policy and returns true', () => {
    const mgr = new RetentionPolicyManager();
    mgr.register({ name: 'x', measurement: 'cpu', durationMs: 0 });
    expect(mgr.remove('x')).toBe(true);
    expect(mgr.get('x')).toBeUndefined();
  });

  it('remove() returns false for unknown name', () => {
    expect(new RetentionPolicyManager().remove('unknown')).toBe(false);
  });

  it('apply() delegates to adapter.applyRetentionPolicy', async () => {
    const mgr = new RetentionPolicyManager();
    const adapter = makeAdapter(5);
    const policy: RetentionPolicy = { name: 'p', measurement: 'cpu', durationMs: 1000 };
    const result = await mgr.apply(adapter, policy);
    expect(adapter.applyRetentionPolicy).toHaveBeenCalledWith(policy);
    expect(result.deletedCount).toBe(5);
  });

  it('applyAll() applies all registered policies in order', async () => {
    const mgr = new RetentionPolicyManager();
    const adapter = makeAdapter(2);
    const p1: RetentionPolicy = { name: 'a', measurement: 'cpu', durationMs: 1_000 };
    const p2: RetentionPolicy = { name: 'b', measurement: 'mem', durationMs: 2_000 };
    mgr.register(p1);
    mgr.register(p2);
    const results = await mgr.applyAll(adapter);
    expect(results).toHaveLength(2);
    expect(adapter.applyRetentionPolicy).toHaveBeenCalledTimes(2);
    expect(adapter.applyRetentionPolicy).toHaveBeenNthCalledWith(1, p1);
    expect(adapter.applyRetentionPolicy).toHaveBeenNthCalledWith(2, p2);
  });

  it('applyAll() returns empty array when no policies registered', async () => {
    const mgr = new RetentionPolicyManager();
    const adapter = makeAdapter();
    const results = await mgr.applyAll(adapter);
    expect(results).toStrictEqual([]);
  });
});
