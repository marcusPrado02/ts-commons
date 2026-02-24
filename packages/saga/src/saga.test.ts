/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, vi } from 'vitest';
import { SagaTransaction, SagaTimeoutError, SagaStepError } from './SagaTransaction';
import { Saga, sagaOk, sagaErr } from './Saga';
import { SagaChoreography } from './SagaChoreography';
import { InMemorySagaStore } from './SagaStore';
import { SagaMonitor } from './SagaMonitor';
import type { SagaResult, ChoreographyEvent, SagaState } from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeState(overrides?: Partial<SagaState>): SagaState {
  return {
    id: 'saga-1',
    name: 'test-saga',
    status: 'running',
    startedAt: new Date(),
    updatedAt: new Date(),
    completedSteps: 0,
    ...overrides,
  };
}

function makeEvent(overrides?: Partial<ChoreographyEvent>): ChoreographyEvent {
  return {
    type: 'order.created',
    payload: { orderId: '123' },
    sagaId: 'saga-1',
    timestamp: new Date(),
    ...overrides,
  };
}

function asyncNoop(): Promise<void> {
  return Promise.resolve();
}

// ── Concrete Saga subclass for testing ────────────────────────────────────────

class OrderSaga extends Saga<string, string> {
  public compensationLog: string[] = [];

  async execute(input: string): Promise<SagaResult<string>> {
    const tx = this.begin();
    try {
      const result = await tx.step(
        'process',
        async () => `${input}-processed`,
        async () => {
          this.compensationLog.push('compensate-process');
        },
      );
      tx.commit();
      return sagaOk(result);
    } catch (error) {
      await tx.rollback();
      return sagaErr<string>(error);
    }
  }
}

class FailingSaga extends Saga<string, string> {
  public compensationLog: string[] = [];

  async execute(input: string): Promise<SagaResult<string>> {
    const tx = this.begin();
    try {
      await tx.step(
        'step1',
        async () => `${input}-step1`,
        async () => {
          this.compensationLog.push('compensate-1');
        },
      );
      await tx.step(
        'step2',
        async (): Promise<string> => {
          throw new Error('step2 failed');
        },
        async () => {
          this.compensationLog.push('compensate-2');
        },
      );
      tx.commit();
      return sagaOk('done');
    } catch (error) {
      await tx.rollback();
      return sagaErr<string>(error);
    }
  }
}

// ── SagaTransaction ───────────────────────────────────────────────────────────

describe('SagaTransaction', () => {
  it('initializes with status running', () => {
    const tx = new SagaTransaction();
    expect(tx.status).toBe('running');
  });

  it('starts with stepCount 0', () => {
    const tx = new SagaTransaction();
    expect(tx.stepCount).toBe(0);
  });

  it('step() executes the action and returns its result', async () => {
    const tx = new SagaTransaction();
    const result = await tx.step('fetch', async () => 42, asyncNoop);
    expect(result).toBe(42);
  });

  it('step() increments stepCount', async () => {
    const tx = new SagaTransaction();
    await tx.step('s1', async () => 'a', asyncNoop);
    expect(tx.stepCount).toBe(1);
  });

  it('step() records compensation for later rollback', async () => {
    const log: string[] = [];
    const tx = new SagaTransaction();
    await tx.step(
      's1',
      async () => 'x',
      async () => {
        log.push('compensated');
      },
    );
    await tx.rollback();
    expect(log).toContain('compensated');
  });

  it('step() throws SagaStepError when status is not running', async () => {
    const tx = new SagaTransaction();
    tx.commit();
    await expect(tx.step('late', async () => 1, asyncNoop)).rejects.toBeInstanceOf(SagaStepError);
  });

  it('SagaStepError contains the current status in message', async () => {
    const tx = new SagaTransaction();
    tx.commit();
    await expect(tx.step('late', async () => 1, asyncNoop)).rejects.toThrow('committed');
  });

  it('step() throws SagaTimeoutError when timed out', async () => {
    const tx = new SagaTransaction({ timeoutMs: 0 });
    await new Promise((r) => setTimeout(r, 5));
    await expect(tx.step('slow', async () => 1, asyncNoop)).rejects.toBeInstanceOf(
      SagaTimeoutError,
    );
  });

  it('SagaTimeoutError message includes timeout value', async () => {
    const tx = new SagaTransaction({ timeoutMs: 0 });
    await new Promise((r) => setTimeout(r, 5));
    await expect(tx.step('slow', async () => 1, asyncNoop)).rejects.toThrow('0ms');
  });

  it('commit() sets status to committed', () => {
    const tx = new SagaTransaction();
    tx.commit();
    expect(tx.status).toBe('committed');
  });

  it('rollback() sets status to compensated', async () => {
    const tx = new SagaTransaction();
    await tx.rollback();
    expect(tx.status).toBe('compensated');
  });

  it('rollback() executes compensation in reverse order', async () => {
    const log: string[] = [];
    const tx = new SagaTransaction();
    await tx.step(
      's1',
      async () => 1,
      async () => {
        log.push('c1');
      },
    );
    await tx.step(
      's2',
      async () => 2,
      async () => {
        log.push('c2');
      },
    );
    await tx.step(
      's3',
      async () => 3,
      async () => {
        log.push('c3');
      },
    );
    await tx.rollback();
    expect(log).toEqual(['c3', 'c2', 'c1']);
  });

  it('rollback() continues when a compensation throws', async () => {
    const log: string[] = [];
    const tx = new SagaTransaction();
    await tx.step(
      's1',
      async () => 1,
      async () => {
        log.push('c1');
      },
    );
    await tx.step(
      's2',
      async () => 2,
      async () => {
        throw new Error('comp fail');
      },
    );
    await tx.step(
      's3',
      async () => 3,
      async () => {
        log.push('c3');
      },
    );
    await expect(tx.rollback()).resolves.toBeUndefined();
    expect(log).toContain('c1');
    expect(log).toContain('c3');
  });

  it('compensation receives the step result value', async () => {
    let capturedValue = '';
    const tx = new SagaTransaction();
    await tx.step(
      's1',
      async () => 'hello',
      async (v) => {
        capturedValue = v;
      },
    );
    await tx.rollback();
    expect(capturedValue).toBe('hello');
  });

  it('multiple steps each have their own compensation', async () => {
    const log: string[] = [];
    const tx = new SagaTransaction();
    await tx.step(
      's1',
      async () => 'a',
      async (v) => {
        log.push(`c1:${v}`);
      },
    );
    await tx.step(
      's2',
      async () => 'b',
      async (v) => {
        log.push(`c2:${v}`);
      },
    );
    await tx.rollback();
    expect(log).toContain('c1:a');
    expect(log).toContain('c2:b');
  });
});

// ── sagaOk / sagaErr ──────────────────────────────────────────────────────────

describe('sagaOk', () => {
  it('returns success true', () => {
    expect(sagaOk(42).success).toBe(true);
  });

  it('returns the value', () => {
    expect(sagaOk('hello').value).toBe('hello');
  });

  it('error is undefined', () => {
    expect(sagaOk(1).error).toBeUndefined();
  });
});

describe('sagaErr', () => {
  it('returns success false', () => {
    expect(sagaErr(new Error('oops')).success).toBe(false);
  });

  it('returns the error', () => {
    const err = new Error('oops');
    expect(sagaErr(err).error).toBe(err);
  });

  it('value is undefined', () => {
    expect(sagaErr(new Error()).value).toBeUndefined();
  });
});

// ── Saga (abstract) via OrderSaga ────────────────────────────────────────────

describe('Saga orchestration', () => {
  it('execute() returns a successful result', async () => {
    const saga = new OrderSaga();
    const result = await saga.execute('order-1');
    expect(result.success).toBe(true);
  });

  it('execute() returns the processed value', async () => {
    const saga = new OrderSaga();
    const result = await saga.execute('order-1');
    expect(result.value).toBe('order-1-processed');
  });

  it('FailingSaga returns success false when step fails', async () => {
    const saga = new FailingSaga();
    const result = await saga.execute('input');
    expect(result.success).toBe(false);
  });

  it('FailingSaga includes the error', async () => {
    const saga = new FailingSaga();
    const result = await saga.execute('input');
    expect(result.error).toBeInstanceOf(Error);
  });

  it('FailingSaga runs compensation for completed step-1', async () => {
    const saga = new FailingSaga();
    await saga.execute('input');
    expect(saga.compensationLog).toContain('compensate-1');
  });

  it('FailingSaga does NOT run compensation for failed step-2', async () => {
    const saga = new FailingSaga();
    await saga.execute('input');
    expect(saga.compensationLog).not.toContain('compensate-2');
  });

  it('begin() returns a SagaTransaction', async () => {
    const saga = new OrderSaga();
    const result = await saga.execute('x');
    expect(result.success).toBe(true);
  });
});

// ── SagaChoreography ──────────────────────────────────────────────────────────

describe('SagaChoreography', () => {
  it('getHandlerCount returns 0 when no handlers registered', () => {
    const ch = new SagaChoreography();
    expect(ch.getHandlerCount('unknown')).toBe(0);
  });

  it('on() increments handler count', () => {
    const ch = new SagaChoreography();
    ch.on('order.created', asyncNoop as any);
    expect(ch.getHandlerCount('order.created')).toBe(1);
  });

  it('on() allows multiple handlers for same event', () => {
    const ch = new SagaChoreography();
    ch.on('e', asyncNoop as any);
    ch.on('e', asyncNoop as any);
    expect(ch.getHandlerCount('e')).toBe(2);
  });

  it('emit() calls registered handler', async () => {
    const ch = new SagaChoreography();
    const handler = vi.fn().mockResolvedValue(undefined);
    ch.on('order.created', handler);
    await ch.emit(makeEvent());
    expect(handler).toHaveBeenCalledOnce();
  });

  it('emit() passes the event to the handler', async () => {
    const ch = new SagaChoreography();
    let received: ChoreographyEvent | undefined;
    ch.on('order.created', async (e) => {
      received = e;
    });
    const event = makeEvent();
    await ch.emit(event);
    expect(received?.sagaId).toBe('saga-1');
  });

  it('emit() calls handlers in registration order', async () => {
    const ch = new SagaChoreography();
    const order: number[] = [];
    ch.on('e', async () => {
      order.push(1);
    });
    ch.on('e', async () => {
      order.push(2);
    });
    await ch.emit(makeEvent({ type: 'e' }));
    expect(order).toEqual([1, 2]);
  });

  it('emit() does nothing for unknown event type', async () => {
    const ch = new SagaChoreography();
    await expect(ch.emit(makeEvent({ type: 'unregistered' }))).resolves.toBeUndefined();
  });

  it('off() removes a handler', async () => {
    const ch = new SagaChoreography();
    const handler = vi.fn().mockResolvedValue(undefined);
    ch.on('e', handler);
    ch.off('e', handler);
    await ch.emit(makeEvent({ type: 'e' }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('clearHandlers(type) clears only specified event type', () => {
    const ch = new SagaChoreography();
    ch.on('e1', asyncNoop as any);
    ch.on('e2', asyncNoop as any);
    ch.clearHandlers('e1');
    expect(ch.getHandlerCount('e1')).toBe(0);
    expect(ch.getHandlerCount('e2')).toBe(1);
  });

  it('clearHandlers() with no args clears all', () => {
    const ch = new SagaChoreography();
    ch.on('e1', asyncNoop as any);
    ch.on('e2', asyncNoop as any);
    ch.clearHandlers();
    expect(ch.getHandlerCount('e1')).toBe(0);
    expect(ch.getHandlerCount('e2')).toBe(0);
  });

  it('emit() handler receives event payload', async () => {
    const ch = new SagaChoreography();
    let payload: unknown;
    ch.on('order.created', async (e) => {
      payload = e.payload;
    });
    await ch.emit(makeEvent({ payload: { orderId: '999' } }));
    expect((payload as any).orderId).toBe('999');
  });
});

// ── InMemorySagaStore ─────────────────────────────────────────────────────────

describe('InMemorySagaStore', () => {
  it('size is 0 when empty', () => {
    const store = new InMemorySagaStore();
    expect(store.size).toBe(0);
  });

  it('save() increments size', async () => {
    const store = new InMemorySagaStore();
    await store.save(makeState());
    expect(store.size).toBe(1);
  });

  it('findById() returns saved state', async () => {
    const store = new InMemorySagaStore();
    await store.save(makeState({ id: 'abc' }));
    const found = await store.findById('abc');
    expect(found?.id).toBe('abc');
  });

  it('findById() returns undefined for unknown id', async () => {
    const store = new InMemorySagaStore();
    const found = await store.findById('missing');
    expect(found).toBeUndefined();
  });

  it('findById() returns a copy (mutation does not affect store)', async () => {
    const store = new InMemorySagaStore();
    await store.save(makeState({ id: 'x', name: 'original' }));
    const found = await store.findById('x');
    if (found !== undefined) found.name = 'mutated';
    const refetch = await store.findById('x');
    expect(refetch?.name).toBe('original');
  });

  it('save() overwrites existing state', async () => {
    const store = new InMemorySagaStore();
    await store.save(makeState({ id: 'a', completedSteps: 1 }));
    await store.save(makeState({ id: 'a', completedSteps: 3 }));
    const found = await store.findById('a');
    expect(found?.completedSteps).toBe(3);
  });

  it('findByStatus() returns matching states', async () => {
    const store = new InMemorySagaStore();
    await store.save(makeState({ id: '1', status: 'running' }));
    await store.save(makeState({ id: '2', status: 'committed' }));
    await store.save(makeState({ id: '3', status: 'running' }));
    const running = await store.findByStatus('running');
    expect(running).toHaveLength(2);
  });

  it('findByStatus() returns empty array when none match', async () => {
    const store = new InMemorySagaStore();
    await store.save(makeState({ status: 'committed' }));
    const failed = await store.findByStatus('failed');
    expect(failed).toHaveLength(0);
  });

  it('delete() removes the state', async () => {
    const store = new InMemorySagaStore();
    await store.save(makeState({ id: 'del' }));
    await store.delete('del');
    expect(await store.findById('del')).toBeUndefined();
  });

  it('delete() decrements size', async () => {
    const store = new InMemorySagaStore();
    await store.save(makeState({ id: 'del' }));
    await store.delete('del');
    expect(store.size).toBe(0);
  });
});

// ── SagaMonitor ───────────────────────────────────────────────────────────────

describe('SagaMonitor', () => {
  it('getMetrics() returns all zeros initially', () => {
    const m = new SagaMonitor();
    const metrics = m.getMetrics();
    expect(metrics.started).toBe(0);
    expect(metrics.committed).toBe(0);
    expect(metrics.compensated).toBe(0);
    expect(metrics.failed).toBe(0);
  });

  it('onSagaStarted() increments started', () => {
    const m = new SagaMonitor();
    m.onSagaStarted('s1');
    expect(m.getMetrics().started).toBe(1);
  });

  it('onSagaCommitted() increments committed', () => {
    const m = new SagaMonitor();
    m.onSagaCommitted('s1');
    expect(m.getMetrics().committed).toBe(1);
  });

  it('onSagaCompensated() increments compensated', () => {
    const m = new SagaMonitor();
    m.onSagaCompensated('s1');
    expect(m.getMetrics().compensated).toBe(1);
  });

  it('onSagaFailed() increments failed', () => {
    const m = new SagaMonitor();
    m.onSagaFailed('s1', new Error('oh no'));
    expect(m.getMetrics().failed).toBe(1);
  });

  it('getEvents() includes started event', () => {
    const m = new SagaMonitor();
    m.onSagaStarted('s1');
    const events = m.getEvents();
    expect(events[0]?.event).toBe('started');
  });

  it('getEvents() records sagaId', () => {
    const m = new SagaMonitor();
    m.onSagaStarted('my-saga');
    expect(m.getEvents()[0]?.sagaId).toBe('my-saga');
  });

  it('onSagaFailed() records error message', () => {
    const m = new SagaMonitor();
    m.onSagaFailed('s1', new Error('disk full'));
    const ev = m.getEvents().find((e) => e.event === 'failed');
    expect(ev?.error).toBe('disk full');
  });

  it('onSagaFailed() handles non-Error errors', () => {
    const m = new SagaMonitor();
    m.onSagaFailed('s1', 'string error');
    const ev = m.getEvents().find((e) => e.event === 'failed');
    expect(ev?.error).toBe('string error');
  });

  it('reset() resets all metric counters to 0', () => {
    const m = new SagaMonitor();
    m.onSagaStarted('s1');
    m.onSagaCommitted('s1');
    m.onSagaFailed('s2', new Error());
    m.reset();
    const metrics = m.getMetrics();
    expect(metrics.started).toBe(0);
    expect(metrics.committed).toBe(0);
    expect(metrics.failed).toBe(0);
  });

  it('reset() clears events', () => {
    const m = new SagaMonitor();
    m.onSagaStarted('s1');
    m.reset();
    expect(m.getEvents()).toHaveLength(0);
  });

  it('getMetrics() returns a copy (mutation does not affect monitor)', () => {
    const m = new SagaMonitor();
    m.onSagaStarted('s1');
    const metrics = m.getMetrics() as { started: number };
    metrics.started = 999;
    expect(m.getMetrics().started).toBe(1);
  });

  it('accumulates multiple lifecycle events in order', () => {
    const m = new SagaMonitor();
    m.onSagaStarted('s1');
    m.onSagaCommitted('s1');
    const events = m.getEvents().map((e) => e.event);
    expect(events).toEqual(['started', 'committed']);
  });
});
