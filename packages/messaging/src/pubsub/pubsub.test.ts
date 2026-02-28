// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/explicit-function-return-type, @typescript-eslint/max-params
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TopicRouter } from './TopicRouter';
import { ContentRouter } from './ContentRouter';
import { FanOutBroker } from './FanOutBroker';
import { RequestReplyBroker } from './RequestReplyBroker';
import { MessageFilter, FilteredRouter } from './MessageFilter';
import type { EventEnvelope } from '../envelope/EventEnvelope';

function makeEnvelope<T>(
  eventType: string,
  payload: T,
  extra?: Partial<EventEnvelope<T>>,
): EventEnvelope<T> {
  return {
    eventId: Math.random().toString(36).slice(2),
    eventType,
    eventVersion: '1.0',
    timestamp: new Date().toISOString(),
    payload,
    ...extra,
  };
}

// ─── TopicRouter ─────────────────────────────────────────────────────────────

describe('TopicRouter', () => {
  let router: TopicRouter<unknown>;

  beforeEach(() => {
    router = new TopicRouter();
  });

  it('routes exact topic match', async () => {
    const handler = vi.fn();
    router.subscribe('order.created', handler);
    await router.route(makeEnvelope('order.created', {}));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('does not route non-matching topic', async () => {
    const handler = vi.fn();
    router.subscribe('order.created', handler);
    await router.route(makeEnvelope('order.updated', {}));
    expect(handler).not.toHaveBeenCalled();
  });

  it('routes with * wildcard matching single segment', async () => {
    const handler = vi.fn();
    router.subscribe('order.*', handler);
    await router.route(makeEnvelope('order.created', {}));
    await router.route(makeEnvelope('order.updated', {}));
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('does not match * across segments', async () => {
    const handler = vi.fn();
    router.subscribe('order.*', handler);
    await router.route(makeEnvelope('order.item.added', {}));
    expect(handler).not.toHaveBeenCalled();
  });

  it('routes with # wildcard matching multiple segments', async () => {
    const handler = vi.fn();
    router.subscribe('order.#', handler);
    await router.route(makeEnvelope('order.created', {}));
    await router.route(makeEnvelope('order.item.added', {}));
    await router.route(makeEnvelope('order.nested.deep.event', {}));
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('# matches zero segments', async () => {
    const handler = vi.fn();
    router.subscribe('order.#', handler);
    await router.route(makeEnvelope('order', {}));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('routes to multiple matching subscribers', async () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    router.subscribe('order.*', h1);
    router.subscribe('order.created', h2);
    await router.route(makeEnvelope('order.created', {}));
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('unsubscribe stops routing', async () => {
    const handler = vi.fn();
    const unsub = router.subscribe('order.*', handler);
    unsub();
    await router.route(makeEnvelope('order.created', {}));
    expect(handler).not.toHaveBeenCalled();
  });

  it('subscriberCount reflects subscriptions', () => {
    const u1 = router.subscribe('a', vi.fn());
    const u2 = router.subscribe('b', vi.fn());
    expect(router.subscriberCount()).toBe(2);
    u1();
    expect(router.subscriberCount()).toBe(1);
    u2();
    expect(router.subscriberCount()).toBe(0);
  });

  it('clear removes all subscriptions', async () => {
    const handler = vi.fn();
    router.subscribe('order.#', handler);
    router.clear();
    await router.route(makeEnvelope('order.created', {}));
    expect(handler).not.toHaveBeenCalled();
  });
});

// ─── ContentRouter ────────────────────────────────────────────────────────────

describe('ContentRouter', () => {
  let router: ContentRouter<{ amount: number; status: string }>;

  beforeEach(() => {
    router = new ContentRouter();
  });

  it('routes on eq filter from payload', async () => {
    const handler = vi.fn();
    router.subscribe([{ field: 'status', op: 'eq', value: 'active' }], handler);
    await router.route(makeEnvelope('evt', { amount: 100, status: 'active' }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('does not route when eq filter fails', async () => {
    const handler = vi.fn();
    router.subscribe([{ field: 'status', op: 'eq', value: 'active' }], handler);
    await router.route(makeEnvelope('evt', { amount: 100, status: 'inactive' }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('routes on gt numeric filter', async () => {
    const handler = vi.fn();
    router.subscribe([{ field: 'amount', op: 'gt', value: 50 }], handler);
    await router.route(makeEnvelope('evt', { amount: 100, status: 'ok' }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('routes on combined filters (AND semantics)', async () => {
    const handler = vi.fn();
    router.subscribe(
      [
        { field: 'amount', op: 'gte', value: 100 },
        { field: 'status', op: 'eq', value: 'active' },
      ],
      handler,
    );
    await router.route(makeEnvelope('evt', { amount: 100, status: 'active' }));
    await router.route(makeEnvelope('evt', { amount: 50, status: 'active' }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('routes using custom extract function', async () => {
    const handler = vi.fn();
    router.subscribe(
      [
        {
          field: 'eventType',
          op: 'startsWith',
          value: 'order',
          extract: (e) => e.eventType,
        },
      ],
      handler,
    );
    await router.route(makeEnvelope('order.created', { amount: 1, status: 'ok' }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('routes on in filter', async () => {
    const handler = vi.fn();
    router.subscribe([{ field: 'status', op: 'in', value: ['active', 'pending'] }], handler);
    await router.route(makeEnvelope('evt', { amount: 1, status: 'pending' }));
    await router.route(makeEnvelope('evt', { amount: 1, status: 'closed' }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('unsubscribe stops content routing', async () => {
    const handler = vi.fn();
    const unsub = router.subscribe([{ field: 'status', op: 'eq', value: 'active' }], handler);
    unsub();
    await router.route(makeEnvelope('evt', { amount: 1, status: 'active' }));
    expect(handler).not.toHaveBeenCalled();
  });
});

// ─── FanOutBroker ─────────────────────────────────────────────────────────────

describe('FanOutBroker', () => {
  let broker: FanOutBroker<unknown>;

  beforeEach(() => {
    broker = new FanOutBroker();
  });

  it('delivers to all subscribers', async () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    broker.addSubscriber('a', h1);
    broker.addSubscriber('b', h2);
    await broker.publish(makeEnvelope('evt', {}));
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('publishTo delivers only to specified ids', async () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    broker.addSubscriber('a', h1);
    broker.addSubscriber('b', h2);
    await broker.publishTo(makeEnvelope('evt', {}), ['a']);
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).not.toHaveBeenCalled();
  });

  it('unsub returned by addSubscriber works', async () => {
    const handler = vi.fn();
    const unsub = broker.addSubscriber('x', handler);
    unsub();
    await broker.publish(makeEnvelope('evt', {}));
    expect(handler).not.toHaveBeenCalled();
  });

  it('removeSubscriber removes by id', async () => {
    const h = vi.fn();
    broker.addSubscriber('y', h);
    broker.removeSubscriber('y');
    await broker.publish(makeEnvelope('evt', {}));
    expect(h).not.toHaveBeenCalled();
  });

  it('subscriberCount and subscriberIds are correct', () => {
    broker.addSubscriber('a', vi.fn());
    broker.addSubscriber('b', vi.fn());
    expect(broker.subscriberCount()).toBe(2);
    expect(broker.subscriberIds()).toEqual(expect.arrayContaining(['a', 'b']));
    broker.removeSubscriber('a');
    expect(broker.subscriberCount()).toBe(1);
  });

  it('publishes to zero subscribers without error', async () => {
    await expect(broker.publish(makeEnvelope('evt', {}))).resolves.toBeUndefined();
  });
});

// ─── RequestReplyBroker ──────────────────────────────────────────────────────

describe('RequestReplyBroker', () => {
  it('resolves reply with matching correlationId', async () => {
    const broker = new RequestReplyBroker<{ q: string }, { a: string }>();
    const promise = broker.awaitReply('corr-1');
    const reply = makeEnvelope<{ a: string }>(
      'reply',
      { a: 'answer' },
      { correlationId: 'corr-1' },
    );
    const delivered = broker.deliver(reply);
    expect(delivered).toBe(true);
    await expect(promise).resolves.toMatchObject({ payload: { a: 'answer' } });
  });

  it('returns false when correlationId has no pending waiter', () => {
    const broker = new RequestReplyBroker();
    const delivered = broker.deliver(makeEnvelope('reply', {}, { correlationId: 'unknown' }));
    expect(delivered).toBe(false);
  });

  it('returns false when reply has no correlationId', () => {
    const broker = new RequestReplyBroker();
    const delivered = broker.deliver(makeEnvelope('reply', {}));
    expect(delivered).toBe(false);
  });

  it('times out if no reply delivered', async () => {
    const broker = new RequestReplyBroker();
    await expect(broker.awaitReply('no-reply', { timeoutMs: 20 })).rejects.toThrow('timed out');
  });

  it('cancel removes pending waiter', async () => {
    const broker = new RequestReplyBroker();
    const promise = broker.awaitReply('c1', { timeoutMs: 100 });
    broker.cancel('c1');
    expect(broker.pendingCount()).toBe(0);
    // Promise is still pending but won't reject via cancel (timer cleared)
    // Allow it to eventually resolve; just verify cancel cleared the map:
    void promise.catch(() => undefined);
  });

  it('createReplyListener routes replies automatically', async () => {
    const broker = new RequestReplyBroker<unknown, { msg: string }>();
    const listener = broker.createReplyListener();
    const promise = broker.awaitReply('auto-1');
    const reply = makeEnvelope<{ msg: string }>(
      'reply',
      { msg: 'hi' },
      { correlationId: 'auto-1' },
    );
    listener(reply);
    await expect(promise).resolves.toMatchObject({ payload: { msg: 'hi' } });
  });

  it('clearAll cancels all pending', () => {
    const broker = new RequestReplyBroker();
    void broker.awaitReply('x1', { timeoutMs: 1000 }).catch(() => undefined);
    void broker.awaitReply('x2', { timeoutMs: 1000 }).catch(() => undefined);
    expect(broker.pendingCount()).toBe(2);
    broker.clearAll();
    expect(broker.pendingCount()).toBe(0);
  });
});

// ─── MessageFilter / FilteredRouter ──────────────────────────────────────────

describe('MessageFilter', () => {
  it('passes when no restrictions', () => {
    const filter = new MessageFilter({});
    expect(filter.passes(makeEnvelope('any', {}))).toBe(true);
  });

  it('allows only listed types', () => {
    const filter = new MessageFilter({ allowedTypes: ['order.created'] });
    expect(filter.passes(makeEnvelope('order.created', {}))).toBe(true);
    expect(filter.passes(makeEnvelope('order.updated', {}))).toBe(false);
  });

  it('denies listed types', () => {
    const filter = new MessageFilter({ deniedTypes: ['spam'] });
    expect(filter.passes(makeEnvelope('spam', {}))).toBe(false);
    expect(filter.passes(makeEnvelope('order.ok', {}))).toBe(true);
  });

  it('filters by correlationId', () => {
    const filter = new MessageFilter({ correlationId: 'req-1' });
    expect(filter.passes(makeEnvelope('e', {}, { correlationId: 'req-1' }))).toBe(true);
    expect(filter.passes(makeEnvelope('e', {}, { correlationId: 'req-2' }))).toBe(false);
  });

  it('applies custom filter function', () => {
    const filter = new MessageFilter({ customFilter: (e) => e.eventType.startsWith('order') });
    expect(filter.passes(makeEnvelope('order.x', {}))).toBe(true);
    expect(filter.passes(makeEnvelope('user.x', {}))).toBe(false);
  });

  it('filter() returns only passing envelopes', () => {
    const filter = new MessageFilter({ allowedTypes: ['a', 'b'] });
    const envs = [makeEnvelope('a', {}), makeEnvelope('c', {}), makeEnvelope('b', {})];
    const result = filter.filter(envs);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.eventType)).toEqual(['a', 'b']);
  });
});

describe('FilteredRouter', () => {
  it('only routes messages passing the filter', async () => {
    const router = new FilteredRouter({ allowedTypes: ['order'] });
    const h = vi.fn();
    router.subscribe(h);
    await router.route(makeEnvelope('order', {}));
    await router.route(makeEnvelope('payment', {}));
    expect(h).toHaveBeenCalledOnce();
  });

  it('unsubscribe stops delivery', async () => {
    const router = new FilteredRouter({});
    const h = vi.fn();
    const unsub = router.subscribe(h);
    unsub();
    await router.route(makeEnvelope('any', {}));
    expect(h).not.toHaveBeenCalled();
  });
});
