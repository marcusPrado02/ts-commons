/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  StateMachine,
  InvalidTransitionError,
  ProcessManager,
  ProcessTimeoutScheduler,
  ProcessCorrelator,
  InMemoryProcessStore,
  ProcessMonitor,
} from './index';
import type { TransitionRule, ProcessState, ProcessStatus } from './index';

// ─── Shared domain fixtures ───────────────────────────────────────────────────

type OrderState = 'pending' | 'payment' | 'shipping' | 'delivered' | 'cancelled';

const ORDER_RULES: TransitionRule<OrderState>[] = [
  { from: 'pending', to: 'payment' },
  { from: 'pending', to: 'cancelled' },
  { from: 'payment', to: 'shipping' },
  { from: 'payment', to: 'cancelled' },
  { from: 'shipping', to: 'delivered' },
  { from: 'shipping', to: 'cancelled' },
];

function makeOrderMachine(): StateMachine<OrderState> {
  return new StateMachine(ORDER_RULES);
}

function makeOrderState(
  overrides: Partial<ProcessState<OrderState>> = {},
): ProcessState<OrderState> {
  return {
    id: 'proc-1',
    name: 'OrderProcess',
    status: 'running',
    currentState: 'pending',
    startedAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// Concrete ProcessManager for testing
interface OrderEvent {
  type: 'PaymentReceived' | 'Shipped' | 'Delivered' | 'Cancelled';
  orderId: string;
}

class OrderProcessManager extends ProcessManager<OrderState, OrderEvent> {
  protected readonly name = 'OrderProcess';
  protected readonly machine = makeOrderMachine();
  protected initialState(): OrderState {
    return 'pending';
  }

  readonly store = new InMemoryProcessStore<OrderState>();

  async handle(event: OrderEvent): Promise<void> {
    let state = await this.store.findById(event.orderId);
    if (state === undefined) {
      state = this.begin(event.orderId);
      await this.store.save(state);
    }

    if (event.type === 'PaymentReceived') {
      this.transition(state, 'payment');
    } else if (event.type === 'Shipped') {
      this.transition(state, 'shipping');
    } else if (event.type === 'Delivered') {
      this.transition(state, 'delivered');
      this.complete(state);
    } else {
      // Cancelled
      this.transition(state, 'cancelled');
      this.fail(state, new Error('Order cancelled'));
    }

    await this.store.save(state);
  }

  // Expose protected helpers for testing
  beginPublic(id?: string, correlationId?: string) {
    return this.begin(id, correlationId);
  }
  transitionPublic(state: ProcessState<OrderState>, to: OrderState) {
    return this.transition(state, to);
  }
  completePublic(state: ProcessState<OrderState>) {
    return this.complete(state);
  }
  failPublic(state: ProcessState<OrderState>, error: unknown) {
    return this.fail(state, error);
  }
  timeOutPublic(state: ProcessState<OrderState>) {
    return this.timeOut(state);
  }
  setTimeoutAtPublic(state: ProcessState<OrderState>, at: Date) {
    return this.setTimeoutAt(state, at);
  }
}

// ─── StateMachine ─────────────────────────────────────────────────────────────

describe('StateMachine', () => {
  let machine: StateMachine<OrderState>;

  beforeEach(() => {
    machine = makeOrderMachine();
  });

  it('getRuleCount() returns the number of registered rules', () => {
    expect(machine.getRuleCount()).toBe(ORDER_RULES.length);
  });

  it('canTransition() returns true for allowed transitions', () => {
    expect(machine.canTransition('pending', 'payment')).toBe(true);
    expect(machine.canTransition('payment', 'shipping')).toBe(true);
    expect(machine.canTransition('shipping', 'delivered')).toBe(true);
  });

  it('canTransition() returns false for disallowed transitions', () => {
    expect(machine.canTransition('pending', 'shipping')).toBe(false);
    expect(machine.canTransition('pending', 'delivered')).toBe(false);
    expect(machine.canTransition('delivered', 'pending')).toBe(false);
  });

  it('validateTransition() does not throw for allowed transitions', () => {
    expect(() => machine.validateTransition('pending', 'payment')).not.toThrow();
  });

  it('validateTransition() throws InvalidTransitionError for disallowed transitions', () => {
    expect(() => machine.validateTransition('pending', 'delivered')).toThrow(
      InvalidTransitionError,
    );
  });

  it('InvalidTransitionError message includes from/to states', () => {
    let caught: Error | undefined;
    try {
      machine.validateTransition('pending', 'delivered');
    } catch (e) {
      caught = e as Error;
    }
    expect(caught?.message).toContain('pending');
    expect(caught?.message).toContain('delivered');
  });

  it('InvalidTransitionError has correct name', () => {
    let caught: InvalidTransitionError | undefined;
    try {
      machine.validateTransition('pending', 'delivered');
    } catch (e) {
      caught = e as InvalidTransitionError;
    }
    expect(caught?.name).toBe('InvalidTransitionError');
  });

  it('getAllowedTransitions() returns all reachable states from a given state', () => {
    const allowed = machine.getAllowedTransitions('pending');
    expect(allowed).toContain('payment');
    expect(allowed).toContain('cancelled');
    expect(allowed).not.toContain('shipping');
  });

  it('getAllowedTransitions() returns empty array for terminal states', () => {
    const allowed = machine.getAllowedTransitions('delivered');
    expect(allowed).toHaveLength(0);
  });
});

// ─── ProcessManager ───────────────────────────────────────────────────────────

describe('ProcessManager', () => {
  let pm: OrderProcessManager;

  beforeEach(() => {
    pm = new OrderProcessManager();
  });

  it('begin() creates a process with running status', () => {
    const state = pm.beginPublic('p-1');
    expect(state.status).toBe('running');
  });

  it('begin() uses the provided id', () => {
    const state = pm.beginPublic('my-id');
    expect(state.id).toBe('my-id');
  });

  it('begin() generates an id when none provided', () => {
    const state = pm.beginPublic();
    expect(typeof state.id).toBe('string');
    expect(state.id.length).toBeGreaterThan(0);
  });

  it('begin() sets initial domain state', () => {
    const state = pm.beginPublic();
    expect(state.currentState).toBe('pending');
  });

  it('begin() sets correlationId when provided', () => {
    const state = pm.beginPublic('p-1', 'order-42');
    expect(state.correlationId).toBe('order-42');
  });

  it('transition() changes the current state', () => {
    const state = pm.beginPublic('p-1');
    pm.transitionPublic(state, 'payment');
    expect(state.currentState).toBe('payment');
  });

  it('transition() updates updatedAt', () => {
    const state = pm.beginPublic('p-1');
    const before = state.updatedAt.getTime();
    pm.transitionPublic(state, 'payment');
    expect(state.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('transition() throws for invalid transition', () => {
    const state = pm.beginPublic('p-1');
    expect(() => pm.transitionPublic(state, 'delivered')).toThrow(InvalidTransitionError);
  });

  it('complete() sets status to completed', () => {
    const state = pm.beginPublic('p-1');
    pm.completePublic(state);
    expect(state.status).toBe('completed');
  });

  it('fail() sets status to failed', () => {
    const state = pm.beginPublic('p-1');
    pm.failPublic(state, new Error('oops'));
    expect(state.status).toBe('failed');
  });

  it('fail() records the error', () => {
    const state = pm.beginPublic('p-1');
    const err = new Error('oops');
    pm.failPublic(state, err);
    expect(state.error).toBe(err);
  });

  it('timeOut() sets status to timed-out', () => {
    const state = pm.beginPublic('p-1');
    pm.timeOutPublic(state);
    expect(state.status).toBe('timed-out');
  });

  it('setTimeoutAt() sets the deadline', () => {
    const state = pm.beginPublic('p-1');
    const deadline = new Date('2026-12-31');
    pm.setTimeoutAtPublic(state, deadline);
    expect(state.timeoutAt).toEqual(deadline);
  });

  it('handle() creates and persists a new process on first event', async () => {
    await pm.handle({ type: 'PaymentReceived', orderId: 'order-1' });
    const state = await pm.store.findById('order-1');
    expect(state).toBeDefined();
    expect(state?.currentState).toBe('payment');
  });

  it('handle() transitions through full happy path', async () => {
    const id = 'order-2';
    await pm.handle({ type: 'PaymentReceived', orderId: id });
    await pm.handle({ type: 'Shipped', orderId: id });
    await pm.handle({ type: 'Delivered', orderId: id });
    const state = await pm.store.findById(id);
    expect(state?.currentState).toBe('delivered');
    expect(state?.status).toBe('completed');
  });

  it('handle() marks process as failed on Cancelled', async () => {
    const id = 'order-3';
    await pm.handle({ type: 'PaymentReceived', orderId: id });
    await pm.handle({ type: 'Cancelled', orderId: id });
    const state = await pm.store.findById(id);
    expect(state?.status).toBe('failed');
    expect(state?.currentState).toBe('cancelled');
  });
});

// ─── ProcessTimeoutScheduler ──────────────────────────────────────────────────

describe('ProcessTimeoutScheduler', () => {
  let scheduler: ProcessTimeoutScheduler;

  beforeEach(() => {
    scheduler = new ProcessTimeoutScheduler();
  });

  it('starts with no pending timeouts', () => {
    expect(scheduler.getPendingCount()).toBe(0);
  });

  it('schedule() adds a pending entry', () => {
    scheduler.schedule('p-1', 5000, () => {
      /* noop */
    });
    expect(scheduler.hasPending('p-1')).toBe(true);
    expect(scheduler.getPendingCount()).toBe(1);
  });

  it('getPendingIds() returns all pending process ids', () => {
    scheduler.schedule('p-1', 1000, () => {
      /* noop */
    });
    scheduler.schedule('p-2', 2000, () => {
      /* noop */
    });
    expect(scheduler.getPendingIds()).toContain('p-1');
    expect(scheduler.getPendingIds()).toContain('p-2');
  });

  it('cancel() removes a pending entry', () => {
    scheduler.schedule('p-1', 5000, () => {
      /* noop */
    });
    scheduler.cancel('p-1');
    expect(scheduler.hasPending('p-1')).toBe(false);
    expect(scheduler.getPendingCount()).toBe(0);
  });

  it('cancel() is a no-op for unknown process', () => {
    expect(() => scheduler.cancel('unknown')).not.toThrow();
  });

  it('schedule() replaces an existing timeout for the same process', () => {
    const first = vi.fn();
    const second = vi.fn();
    scheduler.schedule('p-1', 100, first);
    scheduler.schedule('p-1', 100, second);
    expect(scheduler.getPendingCount()).toBe(1);
    scheduler.tick(new Date(Date.now() + 200));
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
  });

  it('tick() fires callbacks whose deadline has passed', () => {
    const cb = vi.fn();
    scheduler.schedule('p-1', 0, cb);
    scheduler.tick(new Date(Date.now() + 100));
    expect(cb).toHaveBeenCalledOnce();
  });

  it('tick() removes fired entries', () => {
    scheduler.schedule('p-1', 0, () => {
      /* noop */
    });
    scheduler.tick(new Date(Date.now() + 100));
    expect(scheduler.hasPending('p-1')).toBe(false);
  });

  it('tick() does not fire callbacks whose deadline has not passed', () => {
    const cb = vi.fn();
    scheduler.schedule('p-1', 10_000, cb);
    scheduler.tick(new Date());
    expect(cb).not.toHaveBeenCalled();
    expect(scheduler.hasPending('p-1')).toBe(true);
  });

  it('tick() fires multiple expired entries in one call', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    scheduler.schedule('p-1', 0, cb1);
    scheduler.schedule('p-2', 0, cb2);
    scheduler.tick(new Date(Date.now() + 100));
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
  });
});

// ─── ProcessCorrelator ────────────────────────────────────────────────────────

describe('ProcessCorrelator', () => {
  let correlator: ProcessCorrelator;

  beforeEach(() => {
    correlator = new ProcessCorrelator();
  });

  it('starts with size 0', () => {
    expect(correlator.size()).toBe(0);
  });

  it('register() maps a correlationId to a processId', () => {
    correlator.register('order-1', 'proc-abc');
    expect(correlator.resolve('order-1')).toBe('proc-abc');
  });

  it('resolve() returns undefined for unknown correlationId', () => {
    expect(correlator.resolve('unknown')).toBeUndefined();
  });

  it('has() returns true after registration', () => {
    correlator.register('order-1', 'proc-abc');
    expect(correlator.has('order-1')).toBe(true);
  });

  it('has() returns false before registration', () => {
    expect(correlator.has('order-1')).toBe(false);
  });

  it('size() reflects the number of correlations', () => {
    correlator.register('c1', 'p1');
    correlator.register('c2', 'p2');
    expect(correlator.size()).toBe(2);
  });

  it('deregister() removes a mapping', () => {
    correlator.register('order-1', 'proc-abc');
    correlator.deregister('order-1');
    expect(correlator.has('order-1')).toBe(false);
    expect(correlator.size()).toBe(0);
  });

  it('deregister() is a no-op for unknown id', () => {
    expect(() => correlator.deregister('unknown')).not.toThrow();
  });

  it('register() overwrites an existing mapping', () => {
    correlator.register('order-1', 'proc-old');
    correlator.register('order-1', 'proc-new');
    expect(correlator.resolve('order-1')).toBe('proc-new');
    expect(correlator.size()).toBe(1);
  });
});

// ─── InMemoryProcessStore ─────────────────────────────────────────────────────

describe('InMemoryProcessStore', () => {
  let store: InMemoryProcessStore<OrderState>;

  beforeEach(() => {
    store = new InMemoryProcessStore();
  });

  it('starts with size 0', () => {
    expect(store.size()).toBe(0);
  });

  it('save() persists a process state', async () => {
    await store.save(makeOrderState());
    expect(store.size()).toBe(1);
  });

  it('findById() returns the saved state', async () => {
    await store.save(makeOrderState({ currentState: 'payment' }));
    const found = await store.findById('proc-1');
    expect(found?.currentState).toBe('payment');
  });

  it('findById() returns undefined for unknown id', async () => {
    expect(await store.findById('missing')).toBeUndefined();
  });

  it('findById() returns a copy (mutation does not affect store)', async () => {
    await store.save(makeOrderState());
    const found = await store.findById('proc-1');
    found!.currentState = 'shipping';
    const again = await store.findById('proc-1');
    expect(again?.currentState).toBe('pending');
  });

  it('save() overwrites an existing state', async () => {
    await store.save(makeOrderState({ currentState: 'pending' }));
    await store.save(makeOrderState({ currentState: 'payment' }));
    const found = await store.findById('proc-1');
    expect(found?.currentState).toBe('payment');
    expect(store.size()).toBe(1);
  });

  it('findByCorrelationId() finds a process via its correlation key', async () => {
    await store.save(makeOrderState({ correlationId: 'order-99' }));
    const found = await store.findByCorrelationId('order-99');
    expect(found?.id).toBe('proc-1');
  });

  it('findByCorrelationId() returns undefined for unknown key', async () => {
    expect(await store.findByCorrelationId('unknown')).toBeUndefined();
  });

  it('findByStatus() returns matching states', async () => {
    await store.save(makeOrderState({ id: 'p1', status: 'running' }));
    await store.save(makeOrderState({ id: 'p2', status: 'completed' as ProcessStatus }));
    const running = await store.findByStatus('running');
    expect(running).toHaveLength(1);
    expect(running[0]!.id).toBe('p1');
  });

  it('findByStatus() returns empty array when none match', async () => {
    await store.save(makeOrderState({ status: 'running' }));
    const completed = await store.findByStatus('completed');
    expect(completed).toHaveLength(0);
  });

  it('delete() removes the state', async () => {
    await store.save(makeOrderState());
    await store.delete('proc-1');
    expect(store.size()).toBe(0);
  });

  it('delete() also clears the correlation index', async () => {
    await store.save(makeOrderState({ correlationId: 'order-99' }));
    await store.delete('proc-1');
    expect(await store.findByCorrelationId('order-99')).toBeUndefined();
  });
});

// ─── ProcessMonitor ───────────────────────────────────────────────────────────

describe('ProcessMonitor', () => {
  let monitor: ProcessMonitor;

  beforeEach(() => {
    monitor = new ProcessMonitor();
  });

  it('getMetrics() starts at all zeros', () => {
    const m = monitor.getMetrics();
    expect(m.started).toBe(0);
    expect(m.completed).toBe(0);
    expect(m.failed).toBe(0);
    expect(m.timedOut).toBe(0);
  });

  it('onStarted() increments started', () => {
    monitor.onStarted('p-1');
    expect(monitor.getMetrics().started).toBe(1);
  });

  it('onCompleted() increments completed', () => {
    monitor.onCompleted('p-1');
    expect(monitor.getMetrics().completed).toBe(1);
  });

  it('onFailed() increments failed', () => {
    monitor.onFailed('p-1');
    expect(monitor.getMetrics().failed).toBe(1);
  });

  it('onTimedOut() increments timedOut', () => {
    monitor.onTimedOut('p-1');
    expect(monitor.getMetrics().timedOut).toBe(1);
  });

  it('getEvents() includes started event', () => {
    monitor.onStarted('p-1');
    const events = monitor.getEvents();
    expect(events[0]?.type).toBe('started');
    expect(events[0]?.processId).toBe('p-1');
  });

  it('onFailed() records error message from Error instance', () => {
    monitor.onFailed('p-1', new Error('boom'));
    const ev = monitor.getEvents()[0];
    expect(ev?.error).toBe('boom');
  });

  it('onFailed() records stringified error for non-Error values', () => {
    monitor.onFailed('p-1', 'string error');
    const ev = monitor.getEvents()[0];
    expect(ev?.error).toBe('string error');
  });

  it('onFailed() records undefined error when not provided', () => {
    monitor.onFailed('p-1');
    const ev = monitor.getEvents()[0];
    expect(ev?.error).toBeUndefined();
  });

  it('onTimedOut() records timed-out event', () => {
    monitor.onTimedOut('p-1');
    const ev = monitor.getEvents()[0];
    expect(ev?.type).toBe('timed-out');
  });

  it('getMetrics() returns a copy (mutation does not affect monitor)', () => {
    monitor.onStarted('p-1');
    const m = monitor.getMetrics();
    m.started = 999;
    expect(monitor.getMetrics().started).toBe(1);
  });

  it('getEvents() returns a copy', () => {
    monitor.onStarted('p-1');
    const events = monitor.getEvents() as any[];
    events[0].processId = 'mutated';
    expect(monitor.getEvents()[0]?.processId).toBe('p-1');
  });

  it('reset() zeroes all counters', () => {
    monitor.onStarted('p-1');
    monitor.onCompleted('p-1');
    monitor.reset();
    const m = monitor.getMetrics();
    expect(m.started).toBe(0);
    expect(m.completed).toBe(0);
  });

  it('reset() clears event history', () => {
    monitor.onStarted('p-1');
    monitor.reset();
    expect(monitor.getEvents()).toHaveLength(0);
  });

  it('accumulates events across multiple lifecycle calls', () => {
    monitor.onStarted('p-1');
    monitor.onCompleted('p-1');
    monitor.onFailed('p-2');
    monitor.onTimedOut('p-3');
    expect(monitor.getEvents()).toHaveLength(4);
  });
});
