/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/require-await */
import { describe, it, expect, vi } from 'vitest';
import { AvailabilitySli, LatencySli, ErrorRateSli, SliTracker } from './SliProviders';
import { SloTracker } from './SloTracker';

// ──────────────────────────────────────────────────────────────────────────────
// SLI Providers
// ──────────────────────────────────────────────────────────────────────────────

describe('AvailabilitySli', () => {
  it('returns 100 when all requests succeed', async () => {
    const sli = new AvailabilitySli(
      async () => 1000,
      async () => 1000,
    );
    expect(await sli.measure()).toBe(100);
  });

  it('returns 99.9 for 1 failure in 1000', async () => {
    const sli = new AvailabilitySli(
      async () => 1000,
      async () => 999,
    );
    expect(await sli.measure()).toBeCloseTo(99.9, 1);
  });

  it('returns 100 when total is zero (no requests yet)', async () => {
    const sli = new AvailabilitySli(
      async () => 0,
      async () => 0,
    );
    expect(await sli.measure()).toBe(100);
  });

  it('has correct name', () => {
    const sli = new AvailabilitySli(
      async () => 0,
      async () => 0,
    );
    expect(sli.name).toBe('availability');
  });
});

describe('LatencySli', () => {
  it('returns 100 when p99 is within threshold', async () => {
    const sli = new LatencySli(200, async () => 150);
    expect(await sli.measure()).toBe(100);
  });

  it('returns 0 when p99 exceeds threshold', async () => {
    const sli = new LatencySli(200, async () => 300);
    expect(await sli.measure()).toBe(0);
  });

  it('uses custom name when provided', () => {
    const sli = new LatencySli(200, async () => 100, 'my_latency');
    expect(sli.name).toBe('my_latency');
  });
});

describe('ErrorRateSli', () => {
  it('returns 100 with zero errors', async () => {
    const sli = new ErrorRateSli(
      async () => 0,
      async () => 1000,
    );
    expect(await sli.measure()).toBe(100);
  });

  it('reflects error rate correctly', async () => {
    const sli = new ErrorRateSli(
      async () => 10,
      async () => 1000,
    );
    expect(await sli.measure()).toBeCloseTo(99.0, 1);
  });
});

describe('SliTracker', () => {
  it('collects and stores SLI results', async () => {
    const provider = { name: 'test', measure: vi.fn().mockResolvedValue(99.5) };
    const tracker = new SliTracker(provider);
    const result = await tracker.collect();
    expect(result.value).toBe(99.5);
    expect(tracker.latest?.value).toBe(99.5);
  });

  it('getHistory returns all results', async () => {
    const provider = { name: 'test', measure: vi.fn().mockResolvedValue(100) };
    const tracker = new SliTracker(provider);
    await tracker.collect();
    await tracker.collect();
    expect(tracker.getHistory().length).toBe(2);
  });

  it('getHistory returns empty array for unknown since', async () => {
    const provider = { name: 'test', measure: vi.fn().mockResolvedValue(100) };
    const tracker = new SliTracker(provider);
    await tracker.collect();
    const future = new Date(Date.now() + 60_000);
    expect(tracker.getHistory(future)).toEqual([]);
  });

  it('latest is undefined with no history', () => {
    const provider = { name: 'test', measure: vi.fn().mockResolvedValue(100) };
    const tracker = new SliTracker(provider);
    expect(tracker.latest).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// SloTracker
// ──────────────────────────────────────────────────────────────────────────────

function makeSloTracker(target: number, measureValue: number) {
  const provider = { name: 'availability', measure: vi.fn().mockResolvedValue(measureValue) };
  const slo = { name: 'api_availability', sliName: 'availability', target, windowMs: 3_600_000 };
  return new SloTracker(slo, provider);
}

describe('SloTracker', () => {
  it('marks SLO as met when SLI meets target', async () => {
    const tracker = makeSloTracker(99.9, 99.95);
    const status = await tracker.evaluate();
    expect(status.met).toBe(true);
  });

  it('marks SLO as not met when SLI below target', async () => {
    const tracker = makeSloTracker(99.9, 99.0);
    const status = await tracker.evaluate();
    expect(status.met).toBe(false);
  });

  it('error budget is exhausted below target', async () => {
    const tracker = makeSloTracker(99.9, 96.0); // well below target
    for (let i = 0; i < 5; i++) await tracker.evaluate();
    const status = await tracker.evaluate();
    expect(status.errorBudget.exhausted).toBe(true);
  });

  it('error budget remaining is 1 when SLI meets target', async () => {
    const tracker = makeSloTracker(99.0, 100);
    const status = await tracker.evaluate();
    expect(status.errorBudget.remaining).toBe(1);
  });

  it('calls burn rate alert handler when firing', async () => {
    const tracker = makeSloTracker(99.9, 50); // heavy failure
    tracker.setBurnRateThreshold(0.01);
    const handler = vi.fn();
    tracker.onBurnRateAlert(handler);
    for (let i = 0; i < 10; i++) await tracker.evaluate();
    expect(handler).toHaveBeenCalled();
  });

  it('unsubscribing stops alert handler', async () => {
    const tracker = makeSloTracker(99.9, 50);
    tracker.setBurnRateThreshold(0.01);
    const handler = vi.fn();
    const unsub = tracker.onBurnRateAlert(handler);
    unsub();
    for (let i = 0; i < 10; i++) await tracker.evaluate();
    expect(handler).not.toHaveBeenCalled();
  });

  it('status includes slo config', async () => {
    const tracker = makeSloTracker(99.9, 99.95);
    const status = await tracker.evaluate();
    expect(status.slo.name).toBe('api_availability');
  });
});
