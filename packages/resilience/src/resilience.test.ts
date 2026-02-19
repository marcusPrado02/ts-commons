/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Bulkhead, BulkheadRejectedError } from './bulkhead/Bulkhead';
import { Fallback } from './fallback/Fallback';
import { Hedge } from './hedge/Hedge';
import { HealthCheck } from './health/HealthCheck';
import type { HealthStatus } from './health/HealthCheck';

// ─── Bulkhead ────────────────────────────────────────────────────────────────

describe('Bulkhead', () => {
  it('executes fn immediately when slots are available', async () => {
    const bh = new Bulkhead(2, 5);
    const result = await bh.execute(() => Promise.resolve(42));
    expect(result).toBe(42);
    expect(bh.getActiveCount()).toBe(0);
  });

  it('queues execution when at max concurrency', async () => {
    const bh = new Bulkhead(1, 5);
    let firstResolve!: () => void;
    const blocker = new Promise<void>(r => {
      firstResolve = r;
    });

    const p1 = bh.execute(() => blocker.then(() => 1));
    // acquireSlot is synchronous: active increments before the first await
    expect(bh.getActiveCount()).toBe(1);
    expect(bh.getQueueSize()).toBe(0);

    const p2 = bh.execute(() => Promise.resolve(2));
    // p2 is now enqueued
    expect(bh.getQueueSize()).toBe(1);

    firstResolve();
    const results = await Promise.all([p1, p2]);
    expect(results[0]).toBe(1);
    expect(results[1]).toBe(2);
    expect(bh.getActiveCount()).toBe(0);
  });

  it('rejects with BulkheadRejectedError when queue is full', async () => {
    const bh = new Bulkhead(1, 0); // maxQueue = 0

    let releaseBlocker!: () => void;
    const block = new Promise<void>(r => {
      releaseBlocker = r;
    });
    const p1 = bh.execute(() => block.then(() => 1));

    // Concurrent slot is full; queue capacity is 0 → immediate rejection
    await expect(bh.execute(() => Promise.resolve(2))).rejects.toBeInstanceOf(
      BulkheadRejectedError,
    );

    releaseBlocker();
    await p1;
  });

  it('getActiveCount decrements to zero after completion', async () => {
    const bh = new Bulkhead(3, 5);
    await Promise.all([
      bh.execute(() => Promise.resolve(1)),
      bh.execute(() => Promise.resolve(2)),
      bh.execute(() => Promise.resolve(3)),
    ]);
    expect(bh.getActiveCount()).toBe(0);
  });

  it('processes queue in FIFO order', async () => {
    const bh = new Bulkhead(1, 5);
    const order: number[] = [];
    let firstResolve!: () => void;
    const block = new Promise<void>(r => {
      firstResolve = r;
    });

    const p1 = bh.execute(() => block.then(() => { order.push(1); return 1; }));
    const p2 = bh.execute(() => Promise.resolve(order.push(2)));
    const p3 = bh.execute(() => Promise.resolve(order.push(3)));
    expect(bh.getQueueSize()).toBe(2);

    firstResolve();
    await Promise.all([p1, p2, p3]);
    expect(order).toEqual([1, 2, 3]);
  });
});

// ─── Fallback ────────────────────────────────────────────────────────────────

describe('Fallback', () => {
  it('returns primary result when primary succeeds', async () => {
    const result = await Fallback.withFallback(
      () => Promise.resolve('primary'),
      () => Promise.resolve('fallback'),
    );
    expect(result).toBe('primary');
  });

  it('returns fallback result when primary fails', async () => {
    const result = await Fallback.withFallback(
      () => Promise.reject(new Error('primary-fail')),
      () => Promise.resolve('fallback'),
    );
    expect(result).toBe('fallback');
  });

  it('propagates fallback error when both fail', async () => {
    const fallbackErr = new Error('fallback-fail');
    await expect(
      Fallback.withFallback(
        () => Promise.reject(new Error('primary-fail')),
        () => Promise.reject(fallbackErr),
      ),
    ).rejects.toThrow('fallback-fail');
  });

  it('withDefault returns defaultValue when primary fails', async () => {
    const result = await Fallback.withDefault(
      () => Promise.reject(new Error('fail')),
      'default-value',
    );
    expect(result).toBe('default-value');
  });
});

// ─── Hedge ───────────────────────────────────────────────────────────────────

describe('Hedge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with result when copies=1', async () => {
    const promise = Hedge.execute(() => Promise.resolve('ok'), { copies: 1 });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe('ok');
  });

  it('resolves with first copy result when primary is fastest', async () => {
    let calls = 0;
    const fn = () => Promise.resolve(++calls);
    const promise = Hedge.execute(fn, { copies: 2, delayMs: 100 });
    // First copy resolves immediately; timer fires after 100 ms but settled=true
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe(1);
  });

  it('uses hedge copy when primary never resolves', async () => {
    let launched = 0;
    const fn = (): Promise<number> => {
      const n = ++launched;
      if (n === 1) {
        return new Promise<number>(() => undefined); // intentionally never resolves
      }
      return Promise.resolve(n);
    };
    const promise = Hedge.execute(fn, { copies: 2, delayMs: 100 });
    vi.advanceTimersByTime(100);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe(2);
  });

  it('rejects when all copies fail', async () => {
    const err = new Error('all-fail');
    const promise = Hedge.execute(
      (): Promise<string> => Promise.reject(err),
      { copies: 2, delayMs: 0 },
    );
    // Attach assertion BEFORE timers fire so the rejection is always handled
    const assertion = expect(promise).rejects.toThrow('all-fail');
    await vi.runAllTimersAsync();
    await assertion;
  });

  it('does not launch additional copies after settlement', async () => {
    const fn = vi.fn(() => Promise.resolve('ok'));
    const promise = Hedge.execute(fn, { copies: 3, delayMs: 50 });
    // First copy resolves in microtasks; timers at 50 ms and 100 ms should be skipped
    await vi.runAllTimersAsync();
    await promise;
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ─── HealthCheck ─────────────────────────────────────────────────────────────

describe('HealthCheck', () => {
  it('returns healthy when all checks pass', async () => {
    const hc = new HealthCheck();
    hc.register({ name: 'db', check: () => Promise.resolve('healthy' as HealthStatus) });
    hc.register({ name: 'cache', check: () => Promise.resolve('healthy' as HealthStatus) });
    const report = await hc.check();
    expect(report.status).toBe('healthy');
    expect(report.checks['db']).toBe('healthy');
    expect(report.checks['cache']).toBe('healthy');
  });

  it('returns unhealthy overall when any check is unhealthy', async () => {
    const hc = new HealthCheck();
    hc.register({ name: 'db', check: () => Promise.resolve('healthy' as HealthStatus) });
    hc.register({ name: 'disk', check: () => Promise.resolve('unhealthy' as HealthStatus) });
    const report = await hc.check();
    expect(report.status).toBe('unhealthy');
    expect(report.checks['disk']).toBe('unhealthy');
  });

  it('returns degraded when degraded but none unhealthy', async () => {
    const hc = new HealthCheck();
    hc.register({ name: 'cache', check: () => Promise.resolve('degraded' as HealthStatus) });
    hc.register({ name: 'db', check: () => Promise.resolve('healthy' as HealthStatus) });
    const report = await hc.check();
    expect(report.status).toBe('degraded');
  });

  it('treats a thrown error as unhealthy for that indicator', async () => {
    const hc = new HealthCheck();
    hc.register({ name: 'broken', check: () => Promise.reject(new Error('conn refused')) });
    const report = await hc.check();
    expect(report.status).toBe('unhealthy');
    expect(report.checks['broken']).toBe('unhealthy');
  });

  it('report includes timestamp and all check names', async () => {
    const before = Date.now();
    const hc = new HealthCheck();
    hc.register({ name: 'api', check: () => Promise.resolve('healthy' as HealthStatus) });
    const report = await hc.check();
    expect(report.timestamp).toBeGreaterThanOrEqual(before);
    expect(Object.keys(report.checks)).toContain('api');
  });
});
