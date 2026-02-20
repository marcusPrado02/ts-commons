import { describe, expect, it, vi } from 'vitest';
import {
  DataLoader,
  DataLoaderRegistry,
  GraphQLFragmentAlreadyRegisteredError,
  GraphQLFederationError,
  GraphQLOperationNotFoundError,
  GraphQLResolverError,
  GraphQLSchemaError,
  GraphQLSubscriptionError,
  InMemoryGraphQLAdapter,
  OperationRegistry,
  ProblemDetailsFormatter,
  SchemaRegistry,
} from './index';
import type { GraphQLContext, GraphQLObject, SubscriptionEvent } from './index';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeContext(): GraphQLContext {
  return { requestId: 'req-1', metadata: {} };
}

function makeResolver(value: GraphQLObject = { ok: true }) {
  return () => Promise.resolve(value);
}

// ---------------------------------------------------------------------------
// GraphQLErrors
// ---------------------------------------------------------------------------

describe('GraphQLErrors', () => {
  it('GraphQLSchemaError stores fragmentName and message', () => {
    const err = new GraphQLSchemaError('User', 'missing closing brace');
    expect(err).toBeInstanceOf(GraphQLSchemaError);
    expect(err.fragmentName).toBe('User');
    expect(err.message).toContain('User');
    expect(err.message).toContain('missing closing brace');
  });

  it('GraphQLResolverError stores operationName and cause', () => {
    const cause = new Error('db timeout');
    const err = new GraphQLResolverError('GetUser', cause);
    expect(err.operationName).toBe('GetUser');
    expect(err.cause).toBe(cause);
  });

  it('GraphQLSubscriptionError stores topic', () => {
    const err = new GraphQLSubscriptionError('user.created');
    expect(err.topic).toBe('user.created');
    expect(err.message).toContain('user.created');
  });

  it('GraphQLFederationError stores serviceName and cause', () => {
    const cause = new Error('unreachable');
    const err = new GraphQLFederationError('inventory', cause);
    expect(err.serviceName).toBe('inventory');
    expect(err.cause).toBe(cause);
  });

  it('GraphQLOperationNotFoundError stores operationName', () => {
    const err = new GraphQLOperationNotFoundError('UpdateProduct');
    expect(err.operationName).toBe('UpdateProduct');
    expect(err.message).toContain('UpdateProduct');
  });

  it('GraphQLFragmentAlreadyRegisteredError stores fragmentName', () => {
    const err = new GraphQLFragmentAlreadyRegisteredError('Query');
    expect(err.fragmentName).toBe('Query');
    expect(err.message).toContain('Query');
  });
});

// ---------------------------------------------------------------------------
// SchemaRegistry
// ---------------------------------------------------------------------------

describe('SchemaRegistry', () => {
  it('registers and retrieves a fragment', () => {
    const registry = new SchemaRegistry();
    registry.register({ name: 'User', sdl: 'type User { id: ID! }' });
    expect(registry.get('User')?.sdl).toBe('type User { id: ID! }');
  });

  it('throws on duplicate registration', () => {
    const registry = new SchemaRegistry();
    registry.register({ name: 'User', sdl: 'type User { id: ID! }' });
    expect(() => registry.register({ name: 'User', sdl: 'type User { id: ID! }' })).toThrow(
      GraphQLFragmentAlreadyRegisteredError,
    );
  });

  it('upsert replaces existing fragment silently', () => {
    const registry = new SchemaRegistry();
    registry.register({ name: 'User', sdl: 'type User { id: ID! }' });
    registry.upsert({ name: 'User', sdl: 'type User { id: ID! name: String! }' });
    expect(registry.get('User')?.sdl).toContain('name');
  });

  it('throws on empty sdl', () => {
    const registry = new SchemaRegistry();
    expect(() => registry.register({ name: 'Query', sdl: '   ' })).toThrow(GraphQLSchemaError);
  });

  it('getFullSchema joins all SDL fragments', () => {
    const registry = new SchemaRegistry();
    registry.register({ name: 'A', sdl: 'type A { x: Int }' });
    registry.register({ name: 'B', sdl: 'type B { y: Int }' });
    const full = registry.getFullSchema();
    expect(full).toContain('type A');
    expect(full).toContain('type B');
  });

  it('has and remove work correctly', () => {
    const registry = new SchemaRegistry();
    registry.register({ name: 'Mutation', sdl: 'type Mutation { noop: Boolean }' });
    expect(registry.has('Mutation')).toBe(true);
    registry.remove('Mutation');
    expect(registry.has('Mutation')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// OperationRegistry
// ---------------------------------------------------------------------------

describe('OperationRegistry', () => {
  it('registers and retrieves an operation', () => {
    const registry = new OperationRegistry();
    const handler = makeResolver();
    registry.register({ type: 'query', name: 'GetUser', handler });
    expect(registry.get('GetUser')?.handler).toBe(handler);
  });

  it('registerAll handles multiple operations', () => {
    const registry = new OperationRegistry();
    registry.registerAll([
      { type: 'query', name: 'Op1', handler: makeResolver() },
      { type: 'mutation', name: 'Op2', handler: makeResolver() },
    ]);
    expect(registry.has('Op1')).toBe(true);
    expect(registry.has('Op2')).toBe(true);
  });

  it('getByType filters correctly', () => {
    const registry = new OperationRegistry();
    registry.register({ type: 'query', name: 'Q1', handler: makeResolver() });
    registry.register({ type: 'mutation', name: 'M1', handler: makeResolver() });
    expect(registry.getByType('query')).toHaveLength(1);
    expect(registry.getByType('mutation')).toHaveLength(1);
  });

  it('unregister removes an operation', () => {
    const registry = new OperationRegistry();
    registry.register({ type: 'query', name: 'Remove', handler: makeResolver() });
    registry.unregister('Remove');
    expect(registry.has('Remove')).toBe(false);
  });

  it('getAll returns all registered operations', () => {
    const registry = new OperationRegistry();
    registry.register({ type: 'query', name: 'X', handler: makeResolver() });
    registry.register({ type: 'query', name: 'Y', handler: makeResolver() });
    expect(registry.getAll()).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// DataLoader
// ---------------------------------------------------------------------------

describe('DataLoader', () => {
  it('load returns value from batch function', async () => {
    const batchFn = vi.fn().mockResolvedValue(['hello']);
    const loader = new DataLoader<string, string>(batchFn);
    const result = await loader.load('key');
    expect(result).toBe('hello');
  });

  it('batches multiple loads into a single batch call', async () => {
    const batchFn = vi
      .fn()
      .mockImplementation((keys: readonly string[]) =>
        Promise.resolve(keys.map((k) => `val:${k}`)),
      );
    const loader = new DataLoader<string, string>(batchFn);
    const [a, b] = await Promise.all([loader.load('a'), loader.load('b')]);
    expect(batchFn).toHaveBeenCalledOnce();
    expect(a).toBe('val:a');
    expect(b).toBe('val:b');
  });

  it('uses cache for repeated loads of same key', async () => {
    const batchFn = vi
      .fn()
      .mockImplementation((keys: readonly string[]) => Promise.resolve(keys.map((k) => `v:${k}`)));
    const loader = new DataLoader<string, string>(batchFn);
    await loader.load('x');
    await loader.load('x');
    expect(batchFn).toHaveBeenCalledOnce();
  });

  it('prime adds value directly to cache', async () => {
    const batchFn = vi.fn().mockResolvedValue([]);
    const loader = new DataLoader<string, string>(batchFn);
    loader.prime('primed', 'direct');
    const result = await loader.load('primed');
    expect(result).toBe('direct');
    expect(batchFn).not.toHaveBeenCalled();
  });

  it('clearCache forces re-fetch', async () => {
    const batchFn = vi
      .fn()
      .mockImplementation((keys: readonly string[]) => Promise.resolve(keys.map(() => 'fresh')));
    const loader = new DataLoader<string, string>(batchFn);
    await loader.load('k');
    loader.clearCache();
    await loader.load('k');
    expect(batchFn).toHaveBeenCalledTimes(2);
  });

  it('loadMany returns results for all keys', async () => {
    const batchFn = vi
      .fn()
      .mockImplementation((keys: readonly string[]) =>
        Promise.resolve(keys.map((k) => k.toUpperCase())),
      );
    const loader = new DataLoader<string, string>(batchFn);
    const results = await loader.loadMany(['a', 'b', 'c']);
    expect(results).toEqual(['A', 'B', 'C']);
  });

  it('loadMany wraps batch errors in Error instances', async () => {
    const err = new Error('not found');
    const batchFn = vi.fn().mockResolvedValue([err]);
    const loader = new DataLoader<string, string>(batchFn);
    const results = await loader.loadMany(['missing']);
    expect(results[0]).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// DataLoaderRegistry
// ---------------------------------------------------------------------------

describe('DataLoaderRegistry', () => {
  it('registers and retrieves a loader', () => {
    const registry = new DataLoaderRegistry();
    const loader = new DataLoader<string, string>(() => Promise.resolve([]));
    registry.register('users', loader);
    expect(registry.get<string, string>('users')).toBe(loader);
  });

  it('has returns correct boolean', () => {
    const registry = new DataLoaderRegistry();
    registry.register('products', new DataLoader<string, string>(() => Promise.resolve([])));
    expect(registry.has('products')).toBe(true);
    expect(registry.has('orders')).toBe(false);
  });

  it('clear removes all loaders', () => {
    const registry = new DataLoaderRegistry();
    registry.register('x', new DataLoader<string, string>(() => Promise.resolve([])));
    registry.clear();
    expect(registry.has('x')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ProblemDetailsFormatter
// ---------------------------------------------------------------------------

describe('ProblemDetailsFormatter', () => {
  it('format returns GraphQLError with Problem Details extensions', () => {
    const formatter = new ProblemDetailsFormatter();
    const err = formatter.format(new Error('Something went wrong'), 500);
    expect(err.message).toBe('Something went wrong');
    expect(err.extensions?.status).toBe(500);
    expect(err.extensions?.title).toBe('Internal Server Error');
    expect(err.extensions?.type).toBeDefined();
  });

  it('format uses provided overrides', () => {
    const formatter = new ProblemDetailsFormatter();
    const err = formatter.format(new Error('Conflict'), 409, {
      type: 'https://example.com/conflict',
      title: 'Resource Conflict',
      detail: 'A duplicate resource exists.',
    });
    expect(err.extensions?.type).toBe('https://example.com/conflict');
    expect(err.extensions?.title).toBe('Resource Conflict');
    expect(err.extensions?.detail).toBe('A duplicate resource exists.');
  });

  it('format uses default type when none provided', () => {
    const formatter = new ProblemDetailsFormatter('https://custom.example.com/error');
    const err = formatter.format(new Error('oops'));
    expect(err.extensions?.type).toBe('https://custom.example.com/error');
  });

  it('formatValidation returns 400 error', () => {
    const formatter = new ProblemDetailsFormatter();
    const err = formatter.formatValidation('Field "email" is required');
    expect(err.extensions?.status).toBe(400);
    expect(err.extensions?.type).toContain('validation');
  });

  it('formatNotFound returns 404 error with resource in detail', () => {
    const formatter = new ProblemDetailsFormatter();
    const err = formatter.formatNotFound('User');
    expect(err.extensions?.status).toBe(404);
    expect(err.extensions?.detail).toContain('User');
  });

  it('formatUnauthorized returns 401 error', () => {
    const formatter = new ProblemDetailsFormatter();
    const err = formatter.formatUnauthorized();
    expect(err.extensions?.status).toBe(401);
    expect(err.message).toBe('Unauthorized');
  });

  it('formatValidation includes detail when provided', () => {
    const formatter = new ProblemDetailsFormatter();
    const err = formatter.formatValidation('invalid', 'field "name" is too long');
    expect(err.extensions?.detail).toBe('field "name" is too long');
  });

  it('format accepts non-Error values', () => {
    const formatter = new ProblemDetailsFormatter();
    const err = formatter.format('plain string error', 400);
    expect(err.message).toBe('plain string error');
  });
});

// ---------------------------------------------------------------------------
// InMemoryGraphQLAdapter — execution
// ---------------------------------------------------------------------------

describe('InMemoryGraphQLAdapter — execute', () => {
  it('executes operation by explicit operationName', async () => {
    const adapter = new InMemoryGraphQLAdapter();
    adapter.registerOperation({
      type: 'query',
      name: 'Ping',
      handler: makeResolver({ alive: true }),
    });
    const res = await adapter.execute(
      { query: 'query Ping { alive }', operationName: 'Ping' },
      makeContext(),
    );
    expect(res.data?.['Ping']).toMatchObject({ alive: true });
    expect(res.errors).toBeUndefined();
  });

  it('infers operationName from query string', async () => {
    const adapter = new InMemoryGraphQLAdapter();
    adapter.registerOperation({
      type: 'query',
      name: 'GetVersion',
      handler: makeResolver({ version: '1.0' }),
    });
    const res = await adapter.execute({ query: 'query GetVersion { version }' }, makeContext());
    expect(res.data?.['GetVersion']).toMatchObject({ version: '1.0' });
  });

  it('returns error when operation name cannot be determined', async () => {
    const adapter = new InMemoryGraphQLAdapter();
    const res = await adapter.execute({ query: '{ user { id } }' }, makeContext());
    expect(res.data).toBeNull();
    expect(res.errors?.[0]?.message).toContain('operation name');
  });

  it('returns error when operation not registered', async () => {
    const adapter = new InMemoryGraphQLAdapter();
    const res = await adapter.execute(
      { query: 'query Unknown { }', operationName: 'Unknown' },
      makeContext(),
    );
    expect(res.data).toBeNull();
    expect(res.errors?.[0]?.message).toContain('Unknown');
  });

  it('captures resolver errors as GraphQL errors', async () => {
    const adapter = new InMemoryGraphQLAdapter();
    adapter.registerOperation({
      type: 'query',
      name: 'Failing',
      handler: () => Promise.reject(new Error('resolver crashed')),
    });
    const res = await adapter.execute(
      { query: 'query Failing { }', operationName: 'Failing' },
      makeContext(),
    );
    expect(res.data).toBeNull();
    expect(res.errors?.[0]?.message).toBe('resolver crashed');
  });

  it('passes variables to the resolver', async () => {
    const received: Array<Record<string, unknown>> = [];
    const handler = (_p: GraphQLObject, args: Record<string, unknown>) => {
      received.push({ ...args });
      return Promise.resolve({ id: args['userId'] });
    };
    const adapter = new InMemoryGraphQLAdapter();
    adapter.registerOperation({ type: 'query', name: 'GetById', handler });
    await adapter.execute(
      { query: 'query GetById($userId: ID!) { id }', variables: { userId: 'u42' } },
      makeContext(),
    );
    expect(received[0]?.['userId']).toBe('u42');
  });

  it('checkHealth returns true', async () => {
    const adapter = new InMemoryGraphQLAdapter();
    expect(await adapter.checkHealth()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// InMemoryGraphQLAdapter — subscriptions
// ---------------------------------------------------------------------------

describe('InMemoryGraphQLAdapter — subscriptions', () => {
  it('subscriber receives published event', () => {
    const adapter = new InMemoryGraphQLAdapter();
    const events: SubscriptionEvent[] = [];
    adapter.subscribe('order.created', (e) => {
      events.push(e);
    });
    adapter.publish('order.created', { orderId: 'o1' });
    expect(events).toHaveLength(1);
    expect(events[0]?.payload).toMatchObject({ orderId: 'o1' });
    expect(events[0]?.topic).toBe('order.created');
  });

  it('multiple subscribers on same topic all receive event', () => {
    const adapter = new InMemoryGraphQLAdapter();
    const received: number[] = [];
    adapter.subscribe('evt', () => {
      received.push(1);
    });
    adapter.subscribe('evt', () => {
      received.push(2);
    });
    adapter.publish('evt', {});
    expect(received).toHaveLength(2);
  });

  it('unsubscribe stops handler from receiving events', () => {
    const adapter = new InMemoryGraphQLAdapter();
    const events: SubscriptionEvent[] = [];
    const unsub = adapter.subscribe('msg', (e) => {
      events.push(e);
    });
    unsub();
    adapter.publish('msg', { text: 'hello' });
    expect(events).toHaveLength(0);
  });

  it('publish to topic with no subscribers is a no-op', () => {
    const adapter = new InMemoryGraphQLAdapter();
    expect(() => adapter.publish('empty.topic', { x: 1 })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// InMemoryGraphQLAdapter — federation
// ---------------------------------------------------------------------------

describe('InMemoryGraphQLAdapter — federation', () => {
  it('registers and retrieves a federation service', () => {
    const adapter = new InMemoryGraphQLAdapter();
    adapter.registerFederationService({
      name: 'products',
      url: 'http://products:4001',
      sdl: 'type Product { id: ID! }',
    });
    const svc = adapter.getFederationService('products');
    expect(svc?.url).toBe('http://products:4001');
  });

  it('getFederationServices returns all registered services', () => {
    const adapter = new InMemoryGraphQLAdapter();
    adapter.registerFederationService({ name: 'a', url: 'http://a', sdl: '' });
    adapter.registerFederationService({ name: 'b', url: 'http://b', sdl: '' });
    expect(adapter.getFederationServices()).toHaveLength(2);
  });

  it('getFederationService returns undefined for unknown service', () => {
    const adapter = new InMemoryGraphQLAdapter();
    expect(adapter.getFederationService('ghost')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Index exports
// ---------------------------------------------------------------------------

describe('Index exports', () => {
  it('exports error classes', () => {
    expect(GraphQLSchemaError).toBeDefined();
    expect(GraphQLResolverError).toBeDefined();
    expect(GraphQLSubscriptionError).toBeDefined();
    expect(GraphQLFederationError).toBeDefined();
    expect(GraphQLOperationNotFoundError).toBeDefined();
    expect(GraphQLFragmentAlreadyRegisteredError).toBeDefined();
  });

  it('exports implementation classes', () => {
    expect(InMemoryGraphQLAdapter).toBeDefined();
    expect(DataLoader).toBeDefined();
    expect(DataLoaderRegistry).toBeDefined();
    expect(SchemaRegistry).toBeDefined();
    expect(OperationRegistry).toBeDefined();
    expect(ProblemDetailsFormatter).toBeDefined();
  });
});
