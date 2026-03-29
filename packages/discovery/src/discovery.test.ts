/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/require-await */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryServiceRegistry } from './ServiceRegistry';
import { RoundRobinBalancer, RandomBalancer, LeastConnectionsBalancer } from './LoadBalancer';
import { HealthChecker } from './HealthChecker';
import type { ServiceInstance } from './types';

function makeInstance(
  overrides: Partial<ServiceInstance> = {},
): Omit<ServiceInstance, 'registeredAt'> {
  return {
    id: 'svc-1',
    name: 'my-service',
    host: 'localhost',
    port: 8080,
    health: 'healthy',
    ...overrides,
  };
}

describe('InMemoryServiceRegistry', () => {
  let registry: InMemoryServiceRegistry;

  beforeEach(() => {
    registry = new InMemoryServiceRegistry();
  });

  it('registers a service instance', () => {
    const inst = registry.register(makeInstance());
    expect(inst.id).toBe('svc-1');
    expect(inst.registeredAt).toBeInstanceOf(Date);
    expect(registry.instanceCount).toBe(1);
  });

  it('discovers all instances of a service', () => {
    registry.register(makeInstance({ id: 'a' }));
    registry.register(makeInstance({ id: 'b' }));
    registry.register(makeInstance({ id: 'c', name: 'other' }));
    const found = registry.discover('my-service');
    expect(found).toHaveLength(2);
  });

  it('discovers only healthy instances with healthyOnly option', () => {
    registry.register(makeInstance({ id: 'a', health: 'healthy' }));
    registry.register(makeInstance({ id: 'b', health: 'unhealthy' }));
    const found = registry.discover('my-service', { healthyOnly: true });
    expect(found).toHaveLength(1);
    expect(found[0]!.id).toBe('a');
  });

  it('filters by tags', () => {
    registry.register(makeInstance({ id: 'a', tags: ['v1', 'prod'] }));
    registry.register(makeInstance({ id: 'b', tags: ['v2', 'prod'] }));
    const found = registry.discover('my-service', { tags: ['v1'] });
    expect(found).toHaveLength(1);
    expect(found[0]!.id).toBe('a');
  });

  it('getHealthy returns only healthy instances', () => {
    registry.register(makeInstance({ id: 'a', health: 'healthy' }));
    registry.register(makeInstance({ id: 'b', health: 'unhealthy' }));
    expect(registry.getHealthy('my-service')).toHaveLength(1);
  });

  it('deregisters an instance', () => {
    registry.register(makeInstance());
    expect(registry.deregister('svc-1')).toBe(true);
    expect(registry.instanceCount).toBe(0);
  });

  it('deregister returns false for unknown id', () => {
    expect(registry.deregister('nope')).toBe(false);
  });

  it('watch fires when instance is registered', () => {
    const handler = vi.fn();
    registry.watch('my-service', handler);
    registry.register(makeInstance());
    expect(handler).toHaveBeenCalledOnce();
  });

  it('watch fires when instance is deregistered', () => {
    registry.register(makeInstance());
    const handler = vi.fn();
    registry.watch('my-service', handler);
    registry.deregister('svc-1');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('unsubscribing from watch stops notifications', () => {
    const handler = vi.fn();
    const unsub = registry.watch('my-service', handler);
    unsub();
    registry.register(makeInstance());
    expect(handler).not.toHaveBeenCalled();
  });

  it('updateHealth changes health status', () => {
    registry.register(makeInstance({ health: 'healthy' }));
    registry.updateHealth('svc-1', 'unhealthy');
    expect(registry.getHealthy('my-service')).toHaveLength(0);
  });

  it('updateHealth returns false for unknown instance', () => {
    expect(registry.updateHealth('ghost', 'unhealthy')).toBe(false);
  });

  it('updateHealth notifies watchers', () => {
    registry.register(makeInstance({ health: 'healthy' }));
    const handler = vi.fn();
    registry.watch('my-service', handler);
    registry.updateHealth('svc-1', 'unhealthy');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('filters by multiple tags (all must match)', () => {
    registry.register(makeInstance({ id: 'a', tags: ['v1', 'prod', 'eu'] }));
    registry.register(makeInstance({ id: 'b', tags: ['v1', 'prod'] }));
    const found = registry.discover('my-service', { tags: ['v1', 'eu'] });
    expect(found).toHaveLength(1);
    expect(found[0]!.id).toBe('a');
  });

  it('stores and returns metadata on registered instance', () => {
    const inst = registry.register(makeInstance({ metadata: { region: 'us-east-1' } }));
    expect(inst.metadata?.['region']).toBe('us-east-1');
  });

  it('discover returns empty array when no instances match', () => {
    expect(registry.discover('unknown-service')).toHaveLength(0);
  });

  it('register overwrites existing instance with same id', () => {
    registry.register(makeInstance({ host: 'host-a' }));
    registry.register(makeInstance({ host: 'host-b' }));
    expect(registry.instanceCount).toBe(1);
    expect(registry.discover('my-service')[0]!.host).toBe('host-b');
  });
});

describe('RoundRobinBalancer', () => {
  it('cycles through instances', () => {
    const balancer = new RoundRobinBalancer();
    const instances = [
      makeInstance({ id: 'a' }) as ServiceInstance,
      makeInstance({ id: 'b' }) as ServiceInstance,
      makeInstance({ id: 'c' }) as ServiceInstance,
    ];
    expect(balancer.next(instances)?.id).toBe('a');
    expect(balancer.next(instances)?.id).toBe('b');
    expect(balancer.next(instances)?.id).toBe('c');
    expect(balancer.next(instances)?.id).toBe('a');
  });

  it('returns undefined for empty list', () => {
    expect(new RoundRobinBalancer().next([])).toBeUndefined();
  });

  it('resets the index', () => {
    const balancer = new RoundRobinBalancer();
    const instances = [
      makeInstance({ id: 'a' }) as ServiceInstance,
      makeInstance({ id: 'b' }) as ServiceInstance,
    ];
    balancer.next(instances);
    balancer.reset();
    expect(balancer.next(instances)?.id).toBe('a');
  });
});

describe('RandomBalancer', () => {
  it('returns an instance from the list', () => {
    const balancer = new RandomBalancer();
    const instances = [
      makeInstance({ id: 'a' }) as ServiceInstance,
      makeInstance({ id: 'b' }) as ServiceInstance,
    ];
    const result = balancer.next(instances);
    expect(['a', 'b']).toContain(result?.id);
  });

  it('returns undefined for empty list', () => {
    expect(new RandomBalancer().next([])).toBeUndefined();
  });
});

describe('LeastConnectionsBalancer', () => {
  it('picks instance with fewest connections', () => {
    const balancer = new LeastConnectionsBalancer();
    const a = makeInstance({ id: 'a' }) as ServiceInstance;
    const b = makeInstance({ id: 'b' }) as ServiceInstance;
    balancer.next([a, b]); // a gets conn
    const next = balancer.next([a, b]); // b has fewer
    expect(next?.id).toBe('b');
  });

  it('release decrements connection count', () => {
    const balancer = new LeastConnectionsBalancer();
    const a = makeInstance({ id: 'a' }) as ServiceInstance;
    balancer.next([a]);
    expect(balancer.getConnections('a')).toBe(1);
    balancer.release('a');
    expect(balancer.getConnections('a')).toBe(0);
  });
});

describe('HealthChecker', () => {
  it('registers and checks a healthy instance', async () => {
    const checker = new HealthChecker();
    checker.register('svc-1', 'my-service', async () => true);
    const status = await checker.check('svc-1');
    expect(status).toBe('healthy');
  });

  it('marks instance unhealthy when check fails', async () => {
    const checker = new HealthChecker();
    checker.register('svc-1', 'my-service', async () => false);
    const status = await checker.check('svc-1');
    expect(status).toBe('unhealthy');
  });

  it('handles exception in check fn as unhealthy', async () => {
    const checker = new HealthChecker();
    checker.register('svc-1', 'my-service', async () => {
      throw new Error('timeout');
    });
    const status = await checker.check('svc-1');
    expect(status).toBe('unhealthy');
  });

  it('returns unknown for unregistered instance', async () => {
    const checker = new HealthChecker();
    expect(await checker.check('nope')).toBe('unknown');
  });

  it('checkAll returns statuses for all registered', async () => {
    const checker = new HealthChecker();
    checker.register('a', 'svc', async () => true);
    checker.register('b', 'svc', async () => false);
    const results = await checker.checkAll();
    expect(results.get('a')).toBe('healthy');
    expect(results.get('b')).toBe('unhealthy');
  });

  it('onHealthChange fires when status changes', async () => {
    const checker = new HealthChecker();
    let healthy = true;
    checker.register('svc-1', 'my-service', async () => healthy);
    const handler = vi.fn();
    checker.onHealthChange(handler);
    await checker.check('svc-1'); // healthy → status set but no change from 'unknown'
    healthy = false;
    await checker.check('svc-1'); // now changes to unhealthy
    expect(handler).toHaveBeenCalledWith('svc-1', 'unhealthy');
  });

  it('unsubscribing from onHealthChange stops notifications', async () => {
    const checker = new HealthChecker();
    let healthy = true;
    checker.register('svc-1', 'my-service', async () => healthy);
    const handler = vi.fn();
    const unsub = checker.onHealthChange(handler);
    await checker.check('svc-1');
    unsub();
    healthy = false;
    await checker.check('svc-1');
    expect(handler).not.toHaveBeenCalledWith('svc-1', 'unhealthy');
  });

  it('registeredCount returns correct count', () => {
    const checker = new HealthChecker();
    checker.register('a', 'svc', async () => true);
    checker.register('b', 'svc', async () => true);
    expect(checker.registeredCount).toBe(2);
  });

  it('getStatus returns current status without running check', () => {
    const checker = new HealthChecker();
    checker.register('svc-1', 'my-service', async () => true);
    expect(checker.getStatus('svc-1')).toBe('unknown');
  });

  it('getStatus returns unknown for unregistered instance', () => {
    expect(new HealthChecker().getStatus('ghost')).toBe('unknown');
  });

  it('getStatus reflects status after check', async () => {
    const checker = new HealthChecker();
    checker.register('svc-1', 'my-service', async () => true);
    await checker.check('svc-1');
    expect(checker.getStatus('svc-1')).toBe('healthy');
  });

  it('consecutiveFailures increments on repeated failures', async () => {
    const checker = new HealthChecker();
    checker.register('svc-1', 'svc', async () => false);
    await checker.check('svc-1');
    await checker.check('svc-1');
    const entry = (
      checker as unknown as { checks: Map<string, { consecutiveFailures: number }> }
    ).checks.get('svc-1');
    expect(entry?.consecutiveFailures).toBe(2);
  });

  it('consecutiveFailures resets on recovery', async () => {
    const checker = new HealthChecker();
    let healthy = false;
    checker.register('svc-1', 'svc', async () => healthy);
    await checker.check('svc-1');
    await checker.check('svc-1');
    healthy = true;
    await checker.check('svc-1');
    const entry = (
      checker as unknown as { checks: Map<string, { consecutiveFailures: number }> }
    ).checks.get('svc-1');
    expect(entry?.consecutiveFailures).toBe(0);
  });

  it('startPolling invokes check on interval', async () => {
    vi.useFakeTimers();
    const checker = new HealthChecker();
    let calls = 0;
    checker.register(
      'svc-1',
      'svc',
      async () => {
        calls++;
        return true;
      },
      100,
    );
    checker.startPolling('svc-1');
    await vi.advanceTimersByTimeAsync(350);
    checker.stopPolling('svc-1');
    vi.useRealTimers();
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it('startPolling is idempotent — does not create duplicate timers', () => {
    vi.useFakeTimers();
    const checker = new HealthChecker();
    checker.register('svc-1', 'svc', async () => true);
    checker.startPolling('svc-1');
    checker.startPolling('svc-1'); // second call should be a no-op
    const timers = (checker as unknown as { timers: Map<string, unknown> }).timers;
    expect(timers.size).toBe(1);
    checker.stopAll();
    vi.useRealTimers();
  });

  it('stopPolling halts interval for a single instance', async () => {
    vi.useFakeTimers();
    const checker = new HealthChecker();
    let calls = 0;
    checker.register(
      'svc-1',
      'svc',
      async () => {
        calls++;
        return true;
      },
      100,
    );
    checker.startPolling('svc-1');
    await vi.advanceTimersByTimeAsync(150);
    checker.stopPolling('svc-1');
    const callsAfterStop = calls;
    await vi.advanceTimersByTimeAsync(300);
    vi.useRealTimers();
    expect(calls).toBe(callsAfterStop);
  });

  it('stopAll halts all running polls', async () => {
    vi.useFakeTimers();
    const checker = new HealthChecker();
    let callsA = 0,
      callsB = 0;
    checker.register(
      'a',
      'svc',
      async () => {
        callsA++;
        return true;
      },
      100,
    );
    checker.register(
      'b',
      'svc',
      async () => {
        callsB++;
        return true;
      },
      100,
    );
    checker.startPolling('a');
    checker.startPolling('b');
    await vi.advanceTimersByTimeAsync(150);
    checker.stopAll();
    const [snapA, snapB] = [callsA, callsB];
    await vi.advanceTimersByTimeAsync(300);
    vi.useRealTimers();
    expect(callsA).toBe(snapA);
    expect(callsB).toBe(snapB);
  });
});
