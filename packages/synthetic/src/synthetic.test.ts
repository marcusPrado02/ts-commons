/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/require-await */
import { describe, it, expect, vi } from 'vitest';
import { SyntheticMonitor } from './SyntheticMonitor';
import type { ApiHealthCheck } from './types';

function makeFetch(status = 200) {
  return vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status });
}

const check: ApiHealthCheck = {
  id: 'hc-001',
  name: 'API health',
  url: 'https://api.example.com/health',
  expectedStatus: 200,
  timeoutMs: 1000,
};

describe('SyntheticMonitor — health checks', () => {
  it('runCheck returns ok result for 200', async () => {
    const monitor = new SyntheticMonitor(makeFetch(200));
    monitor.addCheck(check);
    const result = await monitor.runCheck('hc-001');
    expect(result.ok).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.checkId).toBe('hc-001');
  });

  it('runCheck returns failure for unexpected status', async () => {
    const monitor = new SyntheticMonitor(makeFetch(500));
    monitor.addCheck(check);
    const result = await monitor.runCheck('hc-001');
    expect(result.ok).toBe(false);
  });

  it('runCheck throws for unknown check id', async () => {
    const monitor = new SyntheticMonitor(makeFetch());
    await expect(monitor.runCheck('missing')).rejects.toThrow();
  });

  it('runAll runs all checks', async () => {
    const monitor = new SyntheticMonitor(makeFetch(200));
    monitor.addCheck(check);
    monitor.addCheck({ ...check, id: 'hc-002', name: 'DB health' });
    const results = await monitor.runAll();
    expect(results.length).toBe(2);
  });

  it('getResults filters by checkId', async () => {
    const monitor = new SyntheticMonitor(makeFetch(200));
    monitor.addCheck(check);
    monitor.addCheck({ ...check, id: 'hc-002', name: 'DB health' });
    await monitor.runAll();
    expect(monitor.getResults('hc-001').length).toBe(1);
  });

  it('getFailureRate returns correct rate', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const monitor = new SyntheticMonitor(fetch);
    monitor.addCheck(check);
    await monitor.runCheck('hc-001');
    await monitor.runCheck('hc-001');
    expect(monitor.getFailureRate('hc-001')).toBe(0.5);
  });

  it('alert fires after failureThreshold consecutive failures', async () => {
    const monitor = new SyntheticMonitor(makeFetch(503));
    monitor.addCheck(check);
    const alertHandler = vi.fn();
    monitor.setAlertConfig({ failureThreshold: 2, onAlert: alertHandler });
    await monitor.runCheck('hc-001');
    expect(alertHandler).not.toHaveBeenCalled();
    await monitor.runCheck('hc-001');
    expect(alertHandler).toHaveBeenCalledOnce();
  });

  it('alert count resets after firing — does not re-alert immediately', async () => {
    const monitor = new SyntheticMonitor(makeFetch(503));
    monitor.addCheck(check);
    const alertHandler = vi.fn();
    monitor.setAlertConfig({ failureThreshold: 2, onAlert: alertHandler });
    await monitor.runCheck('hc-001');
    await monitor.runCheck('hc-001'); // fires alert, resets count
    await monitor.runCheck('hc-001'); // only 1 failure after reset → no second alert
    expect(alertHandler).toHaveBeenCalledOnce();
  });

  it('success resets failure count, preventing premature alert', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 503 });
    const monitor = new SyntheticMonitor(fetch);
    monitor.addCheck(check);
    const alertHandler = vi.fn();
    monitor.setAlertConfig({ failureThreshold: 2, onAlert: alertHandler });
    await monitor.runCheck('hc-001'); // failure 1
    await monitor.runCheck('hc-001'); // success → resets
    await monitor.runCheck('hc-001'); // failure 1 again → no alert
    expect(alertHandler).not.toHaveBeenCalled();
  });

  it('addCheck returns this for fluent chaining', () => {
    const monitor = new SyntheticMonitor(makeFetch());
    const result = monitor.addCheck(check).addCheck({ ...check, id: 'hc-002', name: 'DB' });
    expect(result).toBe(monitor);
  });

  it('getResults with no filter returns all results', async () => {
    const monitor = new SyntheticMonitor(makeFetch(200));
    monitor.addCheck(check);
    monitor.addCheck({ ...check, id: 'hc-002', name: 'DB health' });
    await monitor.runAll();
    expect(monitor.getResults().length).toBe(2);
  });

  it('getFailureRate returns 0 when no results recorded', () => {
    const monitor = new SyntheticMonitor(makeFetch());
    monitor.addCheck(check);
    expect(monitor.getFailureRate('hc-001')).toBe(0);
  });

  it('runCheck records error when fetch throws', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('network error'));
    const monitor = new SyntheticMonitor(fetch);
    monitor.addCheck(check);
    const result = await monitor.runCheck('hc-001');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('network error');
    expect(result.statusCode).toBe(0);
  });

  it('runCheck passes region to result', async () => {
    const monitor = new SyntheticMonitor(makeFetch(200));
    monitor.addCheck(check);
    const result = await monitor.runCheck('hc-001', 'eu-west');
    expect(result.region).toBe('eu-west');
  });
});

describe('SyntheticMonitor — user journeys', () => {
  it('passes when all steps succeed', async () => {
    const monitor = new SyntheticMonitor(makeFetch());
    const result = await monitor.runJourney('checkout', [
      {
        name: 'open cart',
        action: async () => {
          /* ok */
        },
      },
      {
        name: 'pay',
        action: async () => {
          /* ok */
        },
      },
    ]);
    expect(result.passed).toBe(true);
    expect(result.steps.length).toBe(2);
  });

  it('stops at first failing step', async () => {
    const monitor = new SyntheticMonitor(makeFetch());
    const result = await monitor.runJourney('checkout', [
      {
        name: 'open cart',
        action: async () => {
          throw new Error('Cart error');
        },
      },
      {
        name: 'pay',
        action: async () => {
          /* ok */
        },
      },
    ]);
    expect(result.passed).toBe(false);
    expect(result.failedStep).toBe('open cart');
    expect(result.steps.length).toBe(1);
  });

  it('reports error message on failure', async () => {
    const monitor = new SyntheticMonitor(makeFetch());
    const result = await monitor.runJourney('test', [
      {
        name: 'step',
        action: async () => {
          throw new Error('oops');
        },
      },
    ]);
    expect(result.error).toBe('oops');
  });
});
