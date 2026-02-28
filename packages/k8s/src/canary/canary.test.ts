/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/require-await */
import { describe, it, expect, vi } from 'vitest';
import { CanaryRelease } from './CanaryRelease';
import type { CanaryConfig, CanaryMetrics, MetricsProvider } from './types';

const cfg: CanaryConfig = {
  appName: 'my-app',
  namespace: 'default',
  stableImage: 'my-app:v1',
  canaryImage: 'my-app:v2',
  initialWeight: 5,
  stepSize: 10,
  errorRateThreshold: 0.05,
  baselineLatencyMs: 200,
};

function makeMetrics(
  canary: Partial<CanaryMetrics> = {},
  stable: Partial<CanaryMetrics> = {},
): MetricsProvider {
  const defaultMetrics: CanaryMetrics = {
    errorRate: 0.01,
    p99LatencyMs: 150,
    requestsPerSecond: 100,
    successRate: 0.99,
  };
  return {
    getMetrics: vi
      .fn()
      .mockImplementation(async (target: 'stable' | 'canary') =>
        target === 'canary' ? { ...defaultMetrics, ...canary } : { ...defaultMetrics, ...stable },
      ),
  };
}

describe('CanaryRelease', () => {
  it('starts with initialWeight and initializing phase', () => {
    const cr = new CanaryRelease(cfg, makeMetrics());
    expect(cr.weight).toBe(5);
    expect(cr.currentPhase).toBe('initializing');
  });

  it('analyse passes when metrics are healthy', async () => {
    const cr = new CanaryRelease(cfg, makeMetrics());
    const result = await cr.analyse();
    expect(result.passed).toBe(true);
  });

  it('analyse fails on high error rate', async () => {
    const cr = new CanaryRelease(cfg, makeMetrics({ errorRate: 0.1 }));
    const result = await cr.analyse();
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('error rate');
  });

  it('analyse fails on high latency', async () => {
    const cr = new CanaryRelease(cfg, makeMetrics({ p99LatencyMs: 300 }));
    const result = await cr.analyse();
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('latency');
  });

  it('promote increments weight on healthy canary', async () => {
    const cr = new CanaryRelease(cfg, makeMetrics());
    const newWeight = await cr.promote();
    expect(newWeight).toBe(15);
    expect(cr.currentPhase).toBe('progressing');
  });

  it('promote does not increment on unhealthy canary', async () => {
    const cr = new CanaryRelease(cfg, makeMetrics({ errorRate: 0.2 }));
    const newWeight = await cr.promote();
    expect(newWeight).toBe(5);
    expect(cr.currentPhase).toBe('failed');
  });

  it('promote sets succeeded phase at 100%', async () => {
    const cr = new CanaryRelease({ ...cfg, initialWeight: 95 }, makeMetrics());
    await cr.promote();
    expect(cr.weight).toBe(100);
    expect(cr.currentPhase).toBe('succeeded');
  });

  it('rollback resets weight to 0', async () => {
    const cr = new CanaryRelease(cfg, makeMetrics());
    await cr.promote();
    await cr.rollback('test rollback');
    expect(cr.weight).toBe(0);
    expect(cr.currentPhase).toBe('rollback');
  });

  it('pause and resume work', () => {
    const cr = new CanaryRelease(cfg, makeMetrics());
    cr.pause();
    expect(cr.currentPhase).toBe('paused');
    cr.resume();
    expect(cr.currentPhase).toBe('progressing');
  });

  it('onAlert handler is called on rollback', async () => {
    const cr = new CanaryRelease(cfg, makeMetrics());
    const handler = vi.fn();
    cr.onAlert(handler);
    await cr.rollback('manual');
    expect(handler).toHaveBeenCalledWith('manual');
  });

  it('onAlert unsubscribe works', async () => {
    const cr = new CanaryRelease(cfg, makeMetrics());
    const handler = vi.fn();
    const unsub = cr.onAlert(handler);
    unsub();
    await cr.rollback('manual');
    expect(handler).not.toHaveBeenCalled();
  });

  it('onPhaseChange handler is called', async () => {
    const cr = new CanaryRelease(cfg, makeMetrics());
    const handler = vi.fn();
    cr.onPhaseChange(handler);
    await cr.promote();
    expect(handler).toHaveBeenCalledWith('progressing');
  });

  it('getStatus returns current state', async () => {
    const cr = new CanaryRelease(cfg, makeMetrics());
    const status = await cr.getStatus();
    expect(status.canaryWeight).toBe(5);
    expect(status.phase).toBe('initializing');
  });
});
