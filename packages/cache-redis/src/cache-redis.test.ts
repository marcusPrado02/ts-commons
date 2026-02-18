/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Vitest mock objects require any-typed assignments */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- Vitest mock arguments */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- Vitest mock property access */
/* eslint-disable @typescript-eslint/no-unsafe-call -- Vitest mock call patterns */
/* eslint-disable @typescript-eslint/unbound-method -- Vitest mocking pattern requires unbound methods */
/* eslint-disable @typescript-eslint/explicit-function-return-type -- test helper functions */
/* eslint-disable max-lines-per-function -- test files naturally have longer functions */
/**
 * Tests for @acme/cache-redis adapter
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Duration } from '@acme/kernel';
import { RedisCache } from './RedisCache';
import { RedisLock, RedisLockError } from './RedisLock';
import { RedisPubSub } from './RedisPubSub';
import { RedisConnection } from './RedisConnection';
import type { RedisClientLike, RedisPubSubClientLike } from './RedisClientLike';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildClient(): RedisClientLike {
  return {
    get:     vi.fn(),
    set:     vi.fn().mockResolvedValue('OK'),
    del:     vi.fn().mockResolvedValue(1),
    exists:  vi.fn(),
    keys:    vi.fn().mockResolvedValue([]),
    publish: vi.fn().mockResolvedValue(1),
    ping:    vi.fn().mockResolvedValue('PONG'),
    quit:    vi.fn().mockResolvedValue('OK'),
  } as unknown as RedisClientLike;
}

function buildSubscriber(
  onMessageCapture: (listener: (ch: string, msg: string) => void) => void,
): RedisPubSubClientLike {
  const sub: RedisPubSubClientLike = {
    subscribe:   vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    on: vi.fn().mockImplementation((event: string, listener) => {
      if (event === 'message') onMessageCapture(listener as (ch: string, msg: string) => void);
      return sub;
    }),
    quit: vi.fn().mockResolvedValue('OK'),
  } as unknown as RedisPubSubClientLike;
  return sub;
}

// ── RedisCache ────────────────────────────────────────────────────────────────

describe('RedisCache', () => {
  let client: RedisClientLike;
  let cache: RedisCache;

  beforeEach(() => {
    client = buildClient();
    cache  = new RedisCache(client);
  });

  it('get() should return Option.some with the deserialized value on a cache hit', async () => {
    const stored = JSON.stringify({ id: '1', name: 'Alice' });
    vi.mocked(client.get).mockResolvedValue(stored);

    const result = await cache.get<{ id: string; name: string }>('user:1');

    expect(result.isSome()).toBe(true);
    expect(result.unwrap()).toEqual({ id: '1', name: 'Alice' });
    expect(client.get).toHaveBeenCalledWith('user:1');
  });

  it('get() should return Option.none when the key does not exist', async () => {
    vi.mocked(client.get).mockResolvedValue(null);

    const result = await cache.get<string>('missing-key');

    expect(result.isNone()).toBe(true);
  });

  it('set() without TTL should call client.set with only key and serialized value', async () => {
    await cache.set('user:1', { id: '1' });

    expect(client.set).toHaveBeenCalledWith('user:1', JSON.stringify({ id: '1' }));
  });

  it('set() with Duration TTL should call client.set with PX and milliseconds', async () => {
    const ttl = Duration.ofSeconds(60);

    await cache.set('user:1', { id: '1' }, ttl);

    expect(client.set).toHaveBeenCalledWith(
      'user:1',
      JSON.stringify({ id: '1' }),
      'PX',
      ttl.toMilliseconds(),
    );
  });

  it('delete() should call client.del with the given key', async () => {
    await cache.delete('user:1');

    expect(client.del).toHaveBeenCalledWith('user:1');
  });

  it('has() should return true when the key exists', async () => {
    vi.mocked(client.exists).mockResolvedValue(1);

    const result = await cache.has('user:1');

    expect(result).toBe(true);
    expect(client.exists).toHaveBeenCalledWith('user:1');
  });

  it('has() should return false when the key does not exist', async () => {
    vi.mocked(client.exists).mockResolvedValue(0);

    const result = await cache.has('missing');

    expect(result).toBe(false);
  });
});

// ── RedisLock ─────────────────────────────────────────────────────────────────

describe('RedisLock', () => {
  let client: RedisClientLike;
  let lock: RedisLock;

  beforeEach(() => {
    client = buildClient();
    lock   = new RedisLock(client, 5_000);
  });

  it('acquire() should return true when SET NX PX returns OK', async () => {
    vi.mocked(client.set).mockResolvedValue('OK');

    const result = await lock.acquire('lock:payment:1', 'owner-a', 5_000);

    expect(result).toBe(true);
    expect(client.set).toHaveBeenCalledWith('lock:payment:1', 'owner-a', 'NX', 'PX', 5_000);
  });

  it('acquire() should return false when the lock is already held (null response)', async () => {
    vi.mocked(client.set).mockResolvedValue(null);

    const result = await lock.acquire('lock:payment:1', 'owner-b');

    expect(result).toBe(false);
  });

  it('withLock() should execute work and release the lock afterwards', async () => {
    vi.mocked(client.set).mockResolvedValue('OK');

    const work = vi.fn().mockResolvedValue('result');

    const result = await lock.withLock('lock:order:1', work);

    expect(result).toBe('result');
    expect(work).toHaveBeenCalledOnce();
    expect(client.del).toHaveBeenCalledWith('lock:order:1'); // released
  });

  it('withLock() should throw RedisLockError when the lock cannot be acquired', async () => {
    vi.mocked(client.set).mockResolvedValue(null);

    await expect(lock.withLock('lock:order:1', vi.fn())).rejects.toThrow(RedisLockError);
  });
});

// ── RedisPubSub ───────────────────────────────────────────────────────────────

describe('RedisPubSub', () => {
  let client: RedisClientLike;
  let subscriber: RedisPubSubClientLike;
  let pubSub: RedisPubSub;
  let messageListener: ((channel: string, message: string) => void) | undefined;

  beforeEach(() => {
    client     = buildClient();
    subscriber = buildSubscriber((l) => { messageListener = l; });
    pubSub     = new RedisPubSub(client, subscriber);
  });

  it('publish() should delegate to the publisher client', async () => {
    vi.mocked(client.publish).mockResolvedValue(3);

    const result = await pubSub.publish('user-events', '{"type":"UserCreated"}');

    expect(result).toBe(3);
    expect(client.publish).toHaveBeenCalledWith('user-events', '{"type":"UserCreated"}');
  });

  it('subscribe() should register a handler and call subscriber.subscribe on first handler', async () => {
    const handler = vi.fn();

    await pubSub.subscribe('user-events', handler);

    expect(subscriber.subscribe).toHaveBeenCalledWith('user-events');
    expect(pubSub.handlerCount('user-events')).toBe(1);
  });

  it('unsubscribe() should remove the handler and call subscriber.unsubscribe when channel is empty', async () => {
    const handler = vi.fn();
    await pubSub.subscribe('user-events', handler);

    await pubSub.unsubscribe('user-events', handler);

    expect(subscriber.unsubscribe).toHaveBeenCalledWith('user-events');
    expect(pubSub.handlerCount('user-events')).toBe(0);
  });

  it('incoming messages should be dispatched to registered handlers', async () => {
    const handler = vi.fn();
    await pubSub.subscribe('user-events', handler);

    // Simulate Redis driver calling the on('message') listener
    messageListener?.('user-events', '{"type":"UserCreated"}');

    expect(handler).toHaveBeenCalledWith('{"type":"UserCreated"}');
  });
});

// ── RedisConnection ───────────────────────────────────────────────────────────

describe('RedisConnection', () => {
  let client: RedisClientLike;
  let connection: RedisConnection;

  beforeEach(() => {
    client     = buildClient();
    connection = new RedisConnection(client);
  });

  it('healthCheck() should return { status: "ok" } and latencyMs when ping succeeds', async () => {
    vi.mocked(client.ping).mockResolvedValue('PONG');

    const result = await connection.healthCheck();

    expect(result.status).toBe('ok');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(client.ping).toHaveBeenCalledOnce();
  });

  it('healthCheck() should return { status: "error" } when ping throws', async () => {
    vi.mocked(client.ping).mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await connection.healthCheck();

    expect(result.status).toBe('error');
    expect(result.message).toContain('ECONNREFUSED');
  });

  it('getClient() should expose the underlying RedisClientLike', () => {
    expect(connection.getClient()).toBe(client);
  });

  it('quit() should call client.quit', async () => {
    await connection.quit();

    expect(client.quit).toHaveBeenCalledOnce();
  });
});
