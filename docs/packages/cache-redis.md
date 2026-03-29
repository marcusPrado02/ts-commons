# @marcusprado02/cache-redis

Redis-backed distributed cache, multi-level (L1 memory + L2 Redis) cache, distributed locks, and pub/sub.

**Install:** `pnpm add @marcusprado02/cache-redis @marcusprado02/kernel`

**Requires:** Redis 6+

---

## `RedisConnection`

```typescript
import { RedisConnection } from '@marcusprado02/cache-redis';

const connection = new RedisConnection({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
  db: 0,
  tls: process.env.NODE_ENV === 'production',
});

// Stop on shutdown
shutdown.register('redis', () => connection.disconnect());
```

---

## `RedisCache` — Basic Cache

```typescript
import { RedisCache } from '@marcusprado02/cache-redis';

const cache = new RedisCache(connection, {
  ttlSeconds: 3600, // default TTL (1 hour)
  keyPrefix: 'orders:', // namespace all keys
});

// Write
await cache.set('order:123', orderDto, { ttlSeconds: 300 });

// Read
const order = await cache.get<OrderDto>('order:123');
// → OrderDto | null

// Delete
await cache.del('order:123');

// Check existence
const exists = await cache.has('order:123');

// Get or compute
const order2 = await cache.getOrSet(
  'order:123',
  () => orderRepo.findById('123'), // called only on cache miss
  { ttlSeconds: 300 },
);
```

---

## `MultiLevelCache` — L1 + L2 Cache

Reads from in-process memory first (L1), falls back to Redis (L2). Writes go to both layers.

```typescript
import { MultiLevelCache, InMemoryCache, RedisCache } from '@marcusprado02/cache-redis';

const cache = new MultiLevelCache({
  l1: new InMemoryCache({
    maxItems: 1000,
    ttlSeconds: 60, // short TTL in memory
  }),
  l2: new RedisCache(connection, {
    ttlSeconds: 3600, // longer TTL in Redis
  }),
});

// Transparent — same API as RedisCache
await cache.set('order:123', orderDto);
const order = await cache.get<OrderDto>('order:123');
// L1 hit → returns without Redis call (~0.01ms)
// L1 miss, L2 hit → pulls from Redis, warms L1 (~2ms)
// L2 miss → returns null (loader via getOrSet)
```

---

## `RedisLock` — Distributed Mutex

Prevents race conditions across multiple service instances.

```typescript
import { RedisLock } from '@marcusprado02/cache-redis';

const lock = new RedisLock(connection, {
  ttlMs: 5_000, // lock expires after 5 seconds (safety net)
  retryDelayMs: 100,
  maxRetries: 10,
});

await lock.acquire('lock:order:123', async () => {
  // Only one instance across all pods executes this block at a time
  const order = await orderRepo.findById('123');
  order.confirm();
  await orderRepo.save(order);
});
// Lock is automatically released when the callback returns or throws
```

---

## `RedisPubSub` — Pub/Sub

Broadcast messages across service instances (e.g. cache invalidation).

```typescript
import { RedisPubSub } from '@marcusprado02/cache-redis';

const pubsub = new RedisPubSub(connection);

// Subscribe
pubsub.subscribe('orders.invalidate', async (orderId: string) => {
  await cache.del(`order:${orderId}`);
});

// Publish (from another instance or service)
await pubsub.publish('orders.invalidate', orderId);
```

---

## `CacheWarmer` — Preloading

Pre-populates cache at service startup to avoid cold-start latency spikes.

```typescript
import { CacheWarmer } from '@marcusprado02/cache-redis';

const warmer = new CacheWarmer(cache);

warmer.register('popular-orders', async () => {
  const orders = await orderRepo.findTopN(100);
  return orders.map((o) => ({ key: `order:${o.id}`, value: o, ttlSeconds: 600 }));
});

await warmer.warmAll(); // called during startup
```

---

## Cache Invalidation Patterns

### Tag-based invalidation

```typescript
// Set with tags
await cache.set('order:123', dto, { tags: ['customer:abc', 'orders'] });

// Invalidate all cache entries tagged 'customer:abc'
await cache.invalidateByTag('customer:abc');
```

### Event-driven invalidation via pub/sub

```typescript
kafkaConsumer.subscribe(async (envelope) => {
  if (envelope.type === 'OrderUpdatedEvent') {
    await pubsub.publish('orders.invalidate', envelope.payload.orderId);
  }
});
```

---

## Summary

| Export            | Purpose                                   |
| ----------------- | ----------------------------------------- |
| `RedisConnection` | Redis client factory                      |
| `RedisCache`      | Simple Redis-backed cache                 |
| `InMemoryCache`   | In-process LRU cache                      |
| `MultiLevelCache` | L1 (memory) + L2 (Redis) layered cache    |
| `RedisLock`       | Distributed mutex (Redlock algorithm)     |
| `RedisPubSub`     | Pub/Sub for cache invalidation and fanout |
| `CacheWarmer`     | Pre-populate cache at startup             |
