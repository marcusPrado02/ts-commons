/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/require-await */
import { describe, it, expect, vi } from 'vitest';
import { ChaosMonkey } from './ChaosMonkey';
import {
  NetworkChaosExperiment,
  ServiceFailureExperiment,
  ResourceExhaustionExperiment,
} from './ChaosExperiments';
import { ChaosExperimentFramework } from './ChaosExperimentFramework';
import { ChaosError } from './types';

// ──────────────────────────────────────────────────────────────────────────────
// ChaosMonkey
// ──────────────────────────────────────────────────────────────────────────────

describe('ChaosMonkey', () => {
  it('injectError throws ChaosError at 100% rate', () => {
    const monkey = new ChaosMonkey({ probability: 1, enabled: true });
    expect(() => monkey.injectError(1.0)).toThrow(ChaosError);
  });

  it('injectError does not throw at 0% rate', () => {
    const monkey = new ChaosMonkey({ probability: 1, enabled: true });
    expect(() => monkey.injectError(0)).not.toThrow();
  });

  it('injectError does nothing when disabled', () => {
    const monkey = new ChaosMonkey({ probability: 1, enabled: false });
    expect(() => monkey.injectError(1.0)).not.toThrow();
  });

  it('injectLatency does nothing when disabled', async () => {
    const monkey = new ChaosMonkey({ probability: 1, enabled: false });
    await expect(monkey.injectLatency(100, 200)).resolves.toBeUndefined();
    expect(monkey.faultCount).toBe(0);
  });

  it('injectLatency does nothing at probability 0', async () => {
    const monkey = new ChaosMonkey({ probability: 0, enabled: true });
    await monkey.injectLatency(0, 1);
    expect(monkey.faultCount).toBe(0);
  });

  it('faultCount increments on error injection', () => {
    const monkey = new ChaosMonkey({ probability: 1, enabled: true });
    try {
      monkey.injectError(1.0);
    } catch {
      /* ignore */
    }
    expect(monkey.faultCount).toBe(1);
  });

  it('setEnabled disables chaos', () => {
    const monkey = new ChaosMonkey({ probability: 1, enabled: true });
    monkey.setEnabled(false);
    expect(monkey.isEnabled).toBe(false);
    expect(() => monkey.injectError(1.0)).not.toThrow();
  });

  it('wrap calls the function', async () => {
    const monkey = new ChaosMonkey({ probability: 0, enabled: true });
    const fn = vi.fn().mockResolvedValue('result');
    const result = await monkey.wrap(fn);
    expect(result).toBe('result');
    expect(fn).toHaveBeenCalledOnce();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// NetworkChaosExperiment
// ──────────────────────────────────────────────────────────────────────────────

describe('NetworkChaosExperiment', () => {
  it('run returns a result with durationMs', async () => {
    const exp = new NetworkChaosExperiment('latency-test', { latencyMs: 1 });
    const result = await exp.run();
    expect(result.experimentId).toBe(exp.id);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('packet loss causes failure', async () => {
    const exp = new NetworkChaosExperiment('loss-test', { latencyMs: 0, packetLossRate: 1.0 });
    const result = await exp.run();
    expect(result.success).toBe(false);
  });

  it('zero packet loss always succeeds', async () => {
    for (let i = 0; i < 5; i++) {
      const exp = new NetworkChaosExperiment('no-loss', { latencyMs: 0, packetLossRate: 0 });
      const result = await exp.run();
      expect(result.success).toBe(true);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ServiceFailureExperiment
// ──────────────────────────────────────────────────────────────────────────────

describe('ServiceFailureExperiment', () => {
  it('always fails at 100% failure rate', async () => {
    const exp = new ServiceFailureExperiment('svc-down', 1.0);
    const result = await exp.run();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('always succeeds at 0% failure rate', async () => {
    const exp = new ServiceFailureExperiment('svc-up', 0);
    const result = await exp.run();
    expect(result.success).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ResourceExhaustionExperiment
// ──────────────────────────────────────────────────────────────────────────────

describe('ResourceExhaustionExperiment', () => {
  it('runs and reports iterations', async () => {
    const exp = new ResourceExhaustionExperiment('cpu-burn', { cpuBurnMs: 1 });
    const result = await exp.run();
    expect(result.success).toBe(true);
    const details = result.details as Record<string, unknown>;
    expect(typeof details['iterations']).toBe('number');
  });

  it('allocates memory when maxMemoryBytes set', async () => {
    const exp = new ResourceExhaustionExperiment('mem', { maxMemoryBytes: 1024, cpuBurnMs: 1 });
    const result = await exp.run();
    const details = result.details as Record<string, unknown>;
    expect(details['allocatedBytes']).toBe(1024);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ChaosExperimentFramework
// ──────────────────────────────────────────────────────────────────────────────

describe('ChaosExperimentFramework', () => {
  it('registers and runs experiments', async () => {
    const fw = new ChaosExperimentFramework();
    const exp = new ServiceFailureExperiment('test', 0);
    fw.register(exp);
    expect(fw.experimentCount).toBe(1);
    const result = await fw.run(exp.id);
    expect(result.experimentId).toBe(exp.id);
  });

  it('throws for unknown experiment id', async () => {
    const fw = new ChaosExperimentFramework();
    await expect(fw.run('bad-id')).rejects.toThrow();
  });

  it('getSummary returns successRate', async () => {
    const fw = new ChaosExperimentFramework();
    const exp = new ServiceFailureExperiment('test', 0);
    fw.register(exp);
    await fw.run(exp.id);
    const summary = fw.getSummary(exp.id);
    expect(summary.successRate).toBe(1);
    expect(summary.totalRuns).toBe(1);
  });

  it('skips run when disabled', async () => {
    const fw = new ChaosExperimentFramework();
    const exp = new ServiceFailureExperiment('test', 1.0);
    fw.register(exp);
    fw.setEnabled(false);
    const result = await fw.run(exp.id);
    expect(result.success).toBe(true); // skipped, not actually run
  });

  it('runAll returns results for all experiments', async () => {
    const fw = new ChaosExperimentFramework();
    fw.register(new ServiceFailureExperiment('a', 0));
    fw.register(new ServiceFailureExperiment('b', 0));
    const results = await fw.runAll();
    expect(results.length).toBe(2);
  });
});
