/* eslint-disable @typescript-eslint/no-unsafe-call -- Vitest mock call patterns */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Vitest mock objects */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- Vitest mock property access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition -- noUncheckedIndexedAccess */
/* eslint-disable @typescript-eslint/explicit-function-return-type -- test helpers */
/* eslint-disable max-lines-per-function -- test files naturally have longer functions */
/* eslint-disable @typescript-eslint/require-await -- test warm functions intentionally omit await */
/**
 * Tests for @acme/cache-redis — caching strategies (Item 48)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Duration } from '@acme/kernel';
import { InMemoryCache } from './strategies/InMemoryCache';
import { MultiLevelCache } from './strategies/MultiLevelCache';
import { CacheTagRegistry } from './strategies/CacheTagRegistry';
import { BloomFilter } from './strategies/BloomFilter';
import { CacheWarmer } from './strategies/CacheWarmer';

// ── InMemoryCache ─────────────────────────────────────────────────────────────

describe('InMemoryCache', () => {
  let cache: InMemoryCache;

  beforeEach(() => {
    cache = new InMemoryCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('get() returns none for a missing key', async () => {
    const result = await cache.get('missing');
    expect(result.isNone()).toBe(true);
  });

  it('set() and get() round-trips a value', async () => {
    await cache.set('user:1', { id: 1, name: 'Alice' });
    const result = await cache.get<{ id: number; name: string }>('user:1');
    expect(result.isSome()).toBe(true);
    expect(result.unwrap()).toEqual({ id: 1, name: 'Alice' });
  });

  it('delete() removes an existing key', async () => {
    await cache.set('k', 'v');
    await cache.delete('k');
    const result = await cache.get('k');
    expect(result.isNone()).toBe(true);
  });

  it('has() returns true for an existing key', async () => {
    await cache.set('k', 'v');
    expect(await cache.has('k')).toBe(true);
  });

  it('has() returns false for a missing key', async () => {
    expect(await cache.has('k')).toBe(false);
  });

  it('get() returns value before TTL expires', async () => {
    vi.useFakeTimers();
    await cache.set('k', 'v', Duration.ofMilliseconds(500));
    vi.advanceTimersByTime(400);
    const result = await cache.get('k');
    expect(result.isSome()).toBe(true);
  });

  it('get() returns none after TTL expires', async () => {
    vi.useFakeTimers();
    await cache.set('k', 'v', Duration.ofMilliseconds(100));
    vi.advanceTimersByTime(101);
    const result = await cache.get('k');
    expect(result.isNone()).toBe(true);
  });

  it('set() without TTL never expires', async () => {
    vi.useFakeTimers();
    await cache.set('k', 'v');
    vi.advanceTimersByTime(999_999);
    const result = await cache.get('k');
    expect(result.isSome()).toBe(true);
  });

  it('size() reflects the number of entries', async () => {
    await cache.set('a', 1);
    await cache.set('b', 2);
    expect(cache.size()).toBe(2);
  });

  it('clear() empties the cache', async () => {
    await cache.set('a', 1);
    await cache.set('b', 2);
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it('evicts oldest entry when maxSize is reached', async () => {
    const small = new InMemoryCache({ maxSize: 2 });
    await small.set('a', 1);
    await small.set('b', 2);
    await small.set('c', 3); // should evict 'a'
    expect(await small.has('a')).toBe(false);
    expect(await small.has('b')).toBe(true);
    expect(await small.has('c')).toBe(true);
  });

  it('updating an existing key does not count as a new entry for eviction', async () => {
    const small = new InMemoryCache({ maxSize: 2 });
    await small.set('a', 1);
    await small.set('b', 2);
    await small.set('a', 99); // update existing key — no eviction
    expect(await small.has('b')).toBe(true);
    const result = await small.get<number>('a');
    expect(result.unwrap()).toBe(99);
  });
});

// ── MultiLevelCache ───────────────────────────────────────────────────────────

describe('MultiLevelCache', () => {
  let l1: InMemoryCache;
  let l2: InMemoryCache;
  let ml: MultiLevelCache;

  beforeEach(() => {
    l1 = new InMemoryCache();
    l2 = new InMemoryCache();
    ml = new MultiLevelCache(l1, l2);
  });

  it('get() returns value from L1 on cache hit', async () => {
    await l1.set('k', 'l1-value');
    const result = await ml.get<string>('k');
    expect(result.isSome()).toBe(true);
    expect(result.unwrap()).toBe('l1-value');
  });

  it('get() reads from L2 on L1 miss', async () => {
    await l2.set('k', 'l2-value');
    const result = await ml.get<string>('k');
    expect(result.isSome()).toBe(true);
    expect(result.unwrap()).toBe('l2-value');
  });

  it('get() populates L1 after an L2 hit', async () => {
    await l2.set('k', 'from-l2');
    await ml.get('k');
    const l1Result = await l1.get<string>('k');
    expect(l1Result.isSome()).toBe(true);
    expect(l1Result.unwrap()).toBe('from-l2');
  });

  it('get() returns none when both tiers miss', async () => {
    const result = await ml.get('k');
    expect(result.isNone()).toBe(true);
  });

  it('set() writes to both L1 and L2', async () => {
    await ml.set('k', 'v');
    expect((await l1.get('k')).isSome()).toBe(true);
    expect((await l2.get('k')).isSome()).toBe(true);
  });

  it('delete() removes from both L1 and L2', async () => {
    await ml.set('k', 'v');
    await ml.delete('k');
    expect((await l1.get('k')).isNone()).toBe(true);
    expect((await l2.get('k')).isNone()).toBe(true);
  });

  it('has() returns true if L1 has the key', async () => {
    await l1.set('k', 'v');
    expect(await ml.has('k')).toBe(true);
  });

  it('has() returns true if only L2 has the key', async () => {
    await l2.set('k', 'v');
    expect(await ml.has('k')).toBe(true);
  });

  it('has() returns false if neither tier has the key', async () => {
    expect(await ml.has('k')).toBe(false);
  });

  it('invalidateL1() removes from L1 only', async () => {
    await ml.set('k', 'v');
    await ml.invalidateL1('k');
    expect((await l1.get('k')).isNone()).toBe(true);
    expect((await l2.get('k')).isSome()).toBe(true);
  });

  it('getOrCompute() computes and caches value on miss', async () => {
    const value = await ml.getOrCompute('k', async () => 42);
    expect(value).toBe(42);
    expect((await ml.get<number>('k')).unwrap()).toBe(42);
  });

  it('getOrCompute() returns cached value without calling fn on hit', async () => {
    await ml.set('k', 99);
    let called = false;
    const value = await ml.getOrCompute('k', async () => {
      called = true;
      return 0;
    });
    expect(value).toBe(99);
    expect(called).toBe(false);
  });

  it('getOrCompute() passes TTL through to set()', async () => {
    vi.useFakeTimers();
    await ml.getOrCompute('k', async () => 'val', Duration.ofMilliseconds(100));
    vi.advanceTimersByTime(101);
    const result = await l1.get('k');
    expect(result.isNone()).toBe(true);
    vi.useRealTimers();
  });
});

// ── CacheTagRegistry ──────────────────────────────────────────────────────────

describe('CacheTagRegistry', () => {
  let registry: CacheTagRegistry;

  beforeEach(() => {
    registry = new CacheTagRegistry();
  });

  it('tag() associates a key with tags', () => {
    registry.tag('user:1', ['users', 'active']);
    expect(registry.getKeysByTag('users')).toContain('user:1');
    expect(registry.getKeysByTag('active')).toContain('user:1');
  });

  it('getKeysByTag() returns empty array for unknown tag', () => {
    expect(registry.getKeysByTag('nope')).toHaveLength(0);
  });

  it('getTagsByKey() returns all tags for a key', () => {
    registry.tag('user:1', ['users', 'premium']);
    const tags = registry.getTagsByKey('user:1');
    expect(tags).toContain('users');
    expect(tags).toContain('premium');
  });

  it('getTagsByKey() returns empty array for unknown key', () => {
    expect(registry.getTagsByKey('missing')).toHaveLength(0);
  });

  it('multiple keys can share the same tag', () => {
    registry.tag('user:1', ['users']);
    registry.tag('user:2', ['users']);
    const keys = registry.getKeysByTag('users');
    expect(keys).toContain('user:1');
    expect(keys).toContain('user:2');
  });

  it('removeKey() removes key from all associated tags', () => {
    registry.tag('user:1', ['users', 'active']);
    registry.removeKey('user:1');
    expect(registry.getKeysByTag('users')).not.toContain('user:1');
    expect(registry.getKeysByTag('active')).not.toContain('user:1');
  });

  it('removeKey() does not affect other keys sharing the same tag', () => {
    registry.tag('user:1', ['users']);
    registry.tag('user:2', ['users']);
    registry.removeKey('user:1');
    expect(registry.getKeysByTag('users')).toContain('user:2');
  });

  it('removeTag() returns all keys that had the tag', () => {
    registry.tag('user:1', ['users']);
    registry.tag('user:2', ['users']);
    const evicted = registry.removeTag('users');
    expect(evicted).toContain('user:1');
    expect(evicted).toContain('user:2');
  });

  it('removeTag() removes the tag from key associations', () => {
    registry.tag('user:1', ['users', 'active']);
    registry.removeTag('users');
    const tags = registry.getTagsByKey('user:1');
    expect(tags).not.toContain('users');
    expect(tags).toContain('active');
  });

  it('removeTag() returns empty array for unknown tag', () => {
    expect(registry.removeTag('nope')).toHaveLength(0);
  });

  it('tagCount() and keyCount() reflect current state', () => {
    registry.tag('k1', ['t1', 't2']);
    registry.tag('k2', ['t2']);
    expect(registry.tagCount()).toBe(2);
    expect(registry.keyCount()).toBe(2);
  });

  it('clear() resets all associations', () => {
    registry.tag('k', ['t']);
    registry.clear();
    expect(registry.tagCount()).toBe(0);
    expect(registry.keyCount()).toBe(0);
  });
});

// ── BloomFilter ───────────────────────────────────────────────────────────────

describe('BloomFilter', () => {
  it('mightContain() returns false for items not added', () => {
    const filter = new BloomFilter(256, 3);
    expect(filter.mightContain('absent')).toBe(false);
  });

  it('mightContain() returns true after add()', () => {
    const filter = new BloomFilter(256, 3);
    filter.add('hello');
    expect(filter.mightContain('hello')).toBe(true);
  });

  it('add() increments item count', () => {
    const filter = new BloomFilter(256, 3);
    filter.add('a');
    filter.add('b');
    expect(filter.getItemCount()).toBe(2);
  });

  it('clear() resets bits and item count', () => {
    const filter = new BloomFilter(256, 3);
    filter.add('a');
    filter.clear();
    expect(filter.getItemCount()).toBe(0);
    expect(filter.mightContain('a')).toBe(false);
  });

  it('multiple items are all reported as mightContain', () => {
    const filter = new BloomFilter(4096, 4);
    const items = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
    for (const item of items) {
      filter.add(item);
    }
    for (const item of items) {
      expect(filter.mightContain(item)).toBe(true);
    }
  });

  it('items in varied key namespaces are distinct', () => {
    const filter = new BloomFilter(4096, 4);
    filter.add('user:1');
    expect(filter.mightContain('user:1')).toBe(true);
    // Different key — no guarantee it is absent, but with a large enough filter
    // and a single addition, collision is extremely unlikely:
    expect(filter.mightContain('user:999999')).toBe(false);
  });

  it('estimatedFalsePositiveRate() is 0 for an empty filter', () => {
    const filter = new BloomFilter(256, 3);
    expect(filter.estimatedFalsePositiveRate()).toBe(0);
  });

  it('estimatedFalsePositiveRate() increases as items are added', () => {
    const filter = new BloomFilter(64, 3);
    const rateBefore = filter.estimatedFalsePositiveRate();
    for (let i = 0; i < 20; i++) {
      filter.add(String(i));
    }
    const rateAfter = filter.estimatedFalsePositiveRate();
    expect(rateAfter).toBeGreaterThan(rateBefore);
  });

  it('different hash seeds produce distinct bit positions', () => {
    // Adding two clearly different items should both be found
    const filter = new BloomFilter(1024, 5);
    filter.add('abc');
    filter.add('xyz');
    expect(filter.mightContain('abc')).toBe(true);
    expect(filter.mightContain('xyz')).toBe(true);
  });
});

// ── CacheWarmer ───────────────────────────────────────────────────────────────

describe('CacheWarmer', () => {
  let l1: InMemoryCache;
  let warmer: CacheWarmer;

  beforeEach(() => {
    l1 = new InMemoryCache();
    warmer = new CacheWarmer(l1);
  });

  it('has() returns false before registration', () => {
    expect(warmer.has('products')).toBe(false);
  });

  it('register() makes has() return true', () => {
    warmer.register('products', async () => []);
    expect(warmer.has('products')).toBe(true);
  });

  it('unregister() removes the warmer', () => {
    warmer.register('products', async () => []);
    warmer.unregister('products');
    expect(warmer.has('products')).toBe(false);
  });

  it('warmerCount() reflects registered warmers', () => {
    warmer.register('a', async () => []);
    warmer.register('b', async () => []);
    expect(warmer.warmerCount()).toBe(2);
    warmer.unregister('a');
    expect(warmer.warmerCount()).toBe(1);
  });

  it('warm() populates the cache with returned items', async () => {
    warmer.register('users', async () => [
      { key: 'user:1', value: { name: 'Alice' } },
      { key: 'user:2', value: { name: 'Bob' } },
    ]);
    await warmer.warm('users');
    expect((await l1.get('user:1')).isSome()).toBe(true);
    expect((await l1.get('user:2')).isSome()).toBe(true);
  });

  it('warm() returns WarmupResult with correct itemCount', async () => {
    warmer.register('items', async () => [
      { key: 'a', value: 1 },
      { key: 'b', value: 2 },
      { key: 'c', value: 3 },
    ]);
    const result = await warmer.warm('items');
    expect(result.name).toBe('items');
    expect(result.itemCount).toBe(3);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('warm() throws for an unregistered warmer', async () => {
    await expect(warmer.warm('unknown')).rejects.toThrow('No warmer registered');
  });

  it('warm() respects TTL on cached items', async () => {
    vi.useFakeTimers();
    warmer.register('ttl-items', async () => [
      { key: 'k', value: 'v', ttl: Duration.ofMilliseconds(200) },
    ]);
    await warmer.warm('ttl-items');
    vi.advanceTimersByTime(201);
    expect((await l1.get('k')).isNone()).toBe(true);
    vi.useRealTimers();
  });

  it('warmAll() runs all registered warmers', async () => {
    warmer.register('set-a', async () => [{ key: 'a', value: 1 }]);
    warmer.register('set-b', async () => [{ key: 'b', value: 2 }]);
    const results = await warmer.warmAll();
    expect(results).toHaveLength(2);
    expect((await l1.get('a')).isSome()).toBe(true);
    expect((await l1.get('b')).isSome()).toBe(true);
  });

  it('warmAll() returns one result object per warmer', async () => {
    warmer.register('x', async () => [{ key: 'x1', value: 'val' }]);
    warmer.register('y', async () => []);
    const results = await warmer.warmAll();
    const names = results.map((r) => r.name);
    expect(names).toContain('x');
    expect(names).toContain('y');
  });

  it('warm() can re-register and replace a warmer', async () => {
    warmer.register('k', async () => [{ key: 'item', value: 'v1' }]);
    await warmer.warm('k');
    warmer.register('k', async () => [{ key: 'item', value: 'v2' }]);
    await warmer.warm('k');
    const result = await l1.get<string>('item');
    expect(result.unwrap()).toBe('v2');
  });
});
