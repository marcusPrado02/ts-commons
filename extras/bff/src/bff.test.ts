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
  ServiceAggregator,
  FunctionResponseShaper,
  ResponseShaperRegistry,
  createBffResponse,
  RestBff,
  GraphQlBff,
  BffRouter,
} from './index.js';
import type { ServiceCall, AggregationResult } from './index.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function okCall<T>(name: string, value: T): ServiceCall<T> {
  return { name, fetch: async () => value };
}

function failCall<T>(name: string, message: string): ServiceCall<T> {
  return {
    name,
    fetch: async () => {
      throw new Error(message);
    },
  };
}

// ─── ServiceAggregator ────────────────────────────────────────────────────────

describe('ServiceAggregator', () => {
  const agg = new ServiceAggregator();

  it('aggregate() returns one result per call', async () => {
    const results = await agg.aggregate([okCall('a', 1), okCall('b', 2)]);
    expect(results).toHaveLength(2);
  });

  it('aggregate() marks successful calls', async () => {
    const results = await agg.aggregate([okCall('a', 42)]);
    expect(results[0]?.succeeded).toBe(true);
    expect(results[0]?.data).toBe(42);
    expect(results[0]?.error).toBeUndefined();
  });

  it('aggregate() captures failed calls without throwing', async () => {
    const results = await agg.aggregate([failCall<number>('a', 'boom')]);
    expect(results[0]?.succeeded).toBe(false);
    expect(results[0]?.error).toBeInstanceOf(Error);
    expect(results[0]?.data).toBeUndefined();
  });

  it('aggregate() handles mixed success/failure', async () => {
    const results = await agg.aggregate([okCall('ok', 1), failCall<number>('err', 'nope')]);
    const ok = results.find((r) => r.name === 'ok');
    const err = results.find((r) => r.name === 'err');
    expect(ok?.succeeded).toBe(true);
    expect(err?.succeeded).toBe(false);
  });

  it('aggregate() preserves call names', async () => {
    const results = await agg.aggregate([okCall('my-service', 0)]);
    expect(results[0]?.name).toBe('my-service');
  });

  it('aggregate() wraps non-Error throws into Error', async () => {
    const call: ServiceCall<number> = {
      name: 'x',
      fetch: async () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'string error';
      },
    };
    const results = await agg.aggregate([call]);
    expect(results[0]?.error).toBeInstanceOf(Error);
  });

  it('aggregateStrict() returns raw values on all-success', async () => {
    const values = await agg.aggregateStrict([okCall('a', 10), okCall('b', 20)]);
    expect(values).toEqual([10, 20]);
  });

  it('aggregateStrict() rejects when any call fails', async () => {
    await expect(
      agg.aggregateStrict([okCall('a', 1), failCall<number>('b', 'fail')]),
    ).rejects.toThrow('fail');
  });

  it('aggregateSequential() returns results in order', async () => {
    const order: string[] = [];
    const calls = [
      {
        name: 'first',
        fetch: async () => {
          order.push('first');
          return 1;
        },
      },
      {
        name: 'second',
        fetch: async () => {
          order.push('second');
          return 2;
        },
      },
    ];
    await agg.aggregateSequential(calls);
    expect(order).toEqual(['first', 'second']);
  });

  it('aggregateSequential() captures failures without aborting', async () => {
    const results = await agg.aggregateSequential([failCall<number>('x', 'err'), okCall('y', 99)]);
    expect(results[0]?.succeeded).toBe(false);
    expect(results[1]?.succeeded).toBe(true);
    expect(results[1]?.data).toBe(99);
  });

  it('aggregate() returns empty array for empty input', async () => {
    const results = await agg.aggregate([]);
    expect(results).toHaveLength(0);
  });
});

// ─── FunctionResponseShaper ───────────────────────────────────────────────────

describe('FunctionResponseShaper', () => {
  it('shape() applies the provided function', () => {
    const shaper = new FunctionResponseShaper<number, string>('web', (n) => `value:${n}`);
    expect(shaper.shape(7)).toBe('value:7');
  });

  it('stores the clientType', () => {
    const shaper = new FunctionResponseShaper<string, string>('mobile', (s) => s);
    expect(shaper.clientType).toBe('mobile');
  });

  it('calls the fn exactly once per shape() invocation', () => {
    const fn = vi.fn((n: number) => n * 2);
    const shaper = new FunctionResponseShaper('web', fn);
    shaper.shape(3);
    expect(fn).toHaveBeenCalledOnce();
  });
});

// ─── ResponseShaperRegistry ───────────────────────────────────────────────────

describe('ResponseShaperRegistry', () => {
  it('register() + shape() applies the shaper for the client type', () => {
    const reg = new ResponseShaperRegistry<number, string>();
    reg.register(new FunctionResponseShaper('web', (n) => `$${n}`));
    expect(reg.shape('web', 10)).toBe('$10');
  });

  it('shape() returns the original data when no shaper is registered', () => {
    const reg = new ResponseShaperRegistry<number, string>();
    expect(reg.shape('mobile', 42)).toBe(42);
  });

  it('has() returns true after registration', () => {
    const reg = new ResponseShaperRegistry<string, string>();
    reg.register(new FunctionResponseShaper('desktop', (s) => s));
    expect(reg.has('desktop')).toBe(true);
  });

  it('has() returns false for unregistered client type', () => {
    const reg = new ResponseShaperRegistry<string, string>();
    expect(reg.has('mobile')).toBe(false);
  });

  it('size() reflects registered count', () => {
    const reg = new ResponseShaperRegistry<number, number>();
    reg.register(new FunctionResponseShaper('web', (n) => n));
    reg.register(new FunctionResponseShaper('mobile', (n) => n));
    expect(reg.size()).toBe(2);
  });

  it('register() is fluent — returns this', () => {
    const reg = new ResponseShaperRegistry<number, number>();
    const returned = reg.register(new FunctionResponseShaper('web', (n) => n));
    expect(returned).toBe(reg);
  });

  it('re-registering a client type replaces the shaper', () => {
    const reg = new ResponseShaperRegistry<number, string>();
    reg.register(new FunctionResponseShaper('web', () => 'old'));
    reg.register(new FunctionResponseShaper('web', () => 'new'));
    expect(reg.shape('web', 0)).toBe('new');
  });
});

// ─── createBffResponse ────────────────────────────────────────────────────────

describe('createBffResponse', () => {
  it('stores the data', () => {
    const r = createBffResponse({ id: 1 }, 'web');
    expect(r.data).toEqual({ id: 1 });
  });

  it('defaults statusCode to 200', () => {
    const r = createBffResponse('hello', 'mobile');
    expect(r.statusCode).toBe(200);
  });

  it('accepts a custom statusCode', () => {
    const r = createBffResponse('x', 'web', 207);
    expect(r.statusCode).toBe(207);
  });

  it('stores the clientType', () => {
    const r = createBffResponse('x', 'desktop');
    expect(r.clientType).toBe('desktop');
  });

  it('respondedAt is a recent Date', () => {
    const before = Date.now();
    const r = createBffResponse(0, 'web');
    const after = Date.now();
    expect(r.respondedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(r.respondedAt.getTime()).toBeLessThanOrEqual(after);
  });
});

// ─── RestBff ──────────────────────────────────────────────────────────────────

describe('RestBff', () => {
  it('handle() returns statusCode 200 when all calls succeed', async () => {
    const bff = new RestBff();
    const response = await bff.handle([okCall('user', { id: 1 })], 'web');
    expect(response.statusCode).toBe(200);
  });

  it('handle() returns statusCode 207 when at least one call fails', async () => {
    const bff = new RestBff();
    const response = await bff.handle([okCall('a', 1), failCall<number>('b', 'oops')], 'web');
    expect(response.statusCode).toBe(207);
  });

  it('handle() includes all result entries in the data map', async () => {
    const bff = new RestBff();
    const response = await bff.handle([okCall('user', 42), okCall('orders', [1, 2])], 'web');
    const map = response.data as Record<string, AggregationResult<unknown>>;
    expect(map).toHaveProperty('user');
    expect(map).toHaveProperty('orders');
  });

  it('handle() applies a registered response shaper', async () => {
    const bff = new RestBff<string>();
    bff.registerShaper(
      new FunctionResponseShaper('mobile', (map) =>
        Object.values(map)
          .map((r) => r.name)
          .join(','),
      ),
    );
    const response = await bff.handle([okCall('svc', 0)], 'mobile');
    expect(response.data).toBe('svc');
  });

  it('handle() returns the unshaped map when no shaper is registered for that client', async () => {
    const bff = new RestBff();
    const response = await bff.handle([okCall('x', 99)], 'desktop');
    const map = response.data as Record<string, AggregationResult<unknown>>;
    expect(map['x']?.succeeded).toBe(true);
  });

  it('handle() sets the clientType on the response', async () => {
    const bff = new RestBff();
    const response = await bff.handle([], 'mobile');
    expect(response.clientType).toBe('mobile');
  });

  it('registerShaper() is fluent — returns this', () => {
    const bff = new RestBff();
    const shaper = new FunctionResponseShaper<
      Record<string, AggregationResult<unknown>>,
      Record<string, unknown>
    >('web', (d) => d);
    expect(bff.registerShaper(shaper)).toBe(bff);
  });
});

// ─── GraphQlBff ───────────────────────────────────────────────────────────────

describe('GraphQlBff', () => {
  it('execute() resolves all registered fields', async () => {
    const gql = new GraphQlBff()
      .addField({ name: 'user', resolve: async () => ({ id: 1 }) })
      .addField({ name: 'posts', resolve: async () => [1, 2, 3] });
    const result = await gql.execute();
    expect(result.data).toHaveProperty('user');
    expect(result.data).toHaveProperty('posts');
    expect(result.errors).toHaveLength(0);
  });

  it('execute() resolves only the requested subset of fields', async () => {
    const gql = new GraphQlBff()
      .addField({ name: 'a', resolve: async () => 1 })
      .addField({ name: 'b', resolve: async () => 2 });
    const result = await gql.execute(['a']);
    expect(result.data).toHaveProperty('a');
    expect(result.data).not.toHaveProperty('b');
  });

  it('execute() captures per-field errors without rejecting', async () => {
    const gql = new GraphQlBff().addField({ name: 'ok', resolve: async () => 1 }).addField({
      name: 'bad',
      resolve: async () => {
        throw new Error('resolver failed');
      },
    });
    const result = await gql.execute();
    expect(result.data).toHaveProperty('ok');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain('resolver failed');
  });

  it('execute() captures an error for an unregistered field name', async () => {
    const gql = new GraphQlBff();
    const result = await gql.execute(['missing']);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain('missing');
  });

  it('execute() with no fields returns empty data and no errors', async () => {
    const gql = new GraphQlBff();
    const result = await gql.execute([]);
    expect(result.data).toEqual({});
    expect(result.errors).toHaveLength(0);
  });

  it('hasField() returns true for a registered field', () => {
    const gql = new GraphQlBff().addField({ name: 'x', resolve: async () => 0 });
    expect(gql.hasField('x')).toBe(true);
  });

  it('hasField() returns false for an unregistered field', () => {
    const gql = new GraphQlBff();
    expect(gql.hasField('y')).toBe(false);
  });

  it('fieldCount() reflects registered fields', () => {
    const gql = new GraphQlBff()
      .addField({ name: 'a', resolve: async () => 1 })
      .addField({ name: 'b', resolve: async () => 2 });
    expect(gql.fieldCount()).toBe(2);
  });

  it('addField() replaces an existing field of the same name', async () => {
    const gql = new GraphQlBff()
      .addField({ name: 'val', resolve: async () => 'old' })
      .addField({ name: 'val', resolve: async () => 'new' });
    const result = await gql.execute(['val']);
    expect(result.data['val']).toBe('new');
  });

  it('addField() is fluent — returns this', () => {
    const gql = new GraphQlBff();
    const returned = gql.addField({ name: 'x', resolve: async () => 0 });
    expect(returned).toBe(gql);
  });
});

// ─── BffRouter ────────────────────────────────────────────────────────────────

describe('BffRouter', () => {
  it('route() dispatches to the correct handler', async () => {
    const webHandler = vi.fn().mockResolvedValue('web-result');
    const router = new BffRouter<string, string>().register('web', webHandler);
    const result = await router.route('req', 'web');
    expect(result).toBe('web-result');
    expect(webHandler).toHaveBeenCalledWith('req');
  });

  it('route() throws when no handler is registered', async () => {
    const router = new BffRouter();
    await expect(router.route({}, 'mobile')).rejects.toThrow(
      'No BFF handler registered for client type: "mobile"',
    );
  });

  it('has() returns true after registration', () => {
    const router = new BffRouter().register('desktop', async () => 'ok');
    expect(router.has('desktop')).toBe(true);
  });

  it('has() returns false for unregistered client type', () => {
    const router = new BffRouter();
    expect(router.has('web')).toBe(false);
  });

  it('size() reflects registered handler count', () => {
    const router = new BffRouter()
      .register('web', async () => 'w')
      .register('mobile', async () => 'm');
    expect(router.size()).toBe(2);
  });

  it('register() is fluent — returns this', () => {
    const router = new BffRouter();
    expect(router.register('web', async () => 'ok')).toBe(router);
  });

  it('routes different client types to different handlers', async () => {
    const webHandler = vi.fn().mockResolvedValue('web');
    const mobileHandler = vi.fn().mockResolvedValue('mobile');
    const router = new BffRouter<null, string>()
      .register('web', webHandler)
      .register('mobile', mobileHandler);
    expect(await router.route(null, 'web')).toBe('web');
    expect(await router.route(null, 'mobile')).toBe('mobile');
    expect(webHandler).toHaveBeenCalledOnce();
    expect(mobileHandler).toHaveBeenCalledOnce();
  });

  it('re-registering a client type replaces the handler', async () => {
    const router = new BffRouter<string, string>()
      .register('web', async () => 'old')
      .register('web', async () => 'new');
    expect(await router.route('r', 'web')).toBe('new');
  });
});
