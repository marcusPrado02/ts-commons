# @acme/cache-redis

Redis cache adapter for Clean Architecture — provides typed classes for caching,
distributed locking, pub/sub messaging, and connection health checks.

Uses **structural interfaces** (`RedisClientLike`, `RedisPubSubClientLike`) so
no `ioredis` import is required inside this library.

---

## Features

- **`RedisCache<T>`** — `get`/`set`/`delete`/`has`/`keys` with `Option<T>` semantics and `Duration`-based TTL
- **`RedisLock`** — Atomic `SET key value NX PX` distributed lock with `withLock()` helper
- **`RedisPubSub`** — Channel pub/sub with in-process handler dispatch (separate publisher + subscriber connections)
- **`RedisConnection`** — PING health check with latency measurement and `quit()`
- **Structural interfaces** — accepts any Redis client cast as `RedisClientLike` (ioredis, node-redis, etc.)
- TypeScript strict mode (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) ✅
- ESLint compliant ✅

---

## Architecture

```
Domain / Application Layer
  └── (uses Option<T>, Duration from @acme/kernel)

Infrastructure Layer
  └── RedisCache          — cache-aside reads / writes
  └── RedisLock           — distributed locking
  └── RedisPubSub         — pub/sub fan-out
  └── RedisConnection     — connection lifecycle & health
           ↑
  RedisClientLike / RedisPubSubClientLike (structural interfaces)
           ↑
  ioredis / node-redis / any compatible client
```

---

## Installation

```bash
pnpm add @acme/cache-redis ioredis
```

`ioredis` is a **peer dependency** — install the version your project already uses (≥ 5.0.0).

---

## Quick Start

### 1. Cache — read with `Option<T>`, write with `Duration` TTL

```typescript
import Redis from 'ioredis';
import { RedisCache } from '@acme/cache-redis';
import { Duration } from '@acme/kernel';

const client = new Redis();
const cache = new RedisCache(client as unknown as RedisClientLike);

// Cache miss → Option.none()
const miss = await cache.get<User>('user:1');
console.log(miss.isNone()); // true

// Write with 5-minute TTL
await cache.set<User>('user:1', { id: 1, name: 'Alice' }, Duration.ofMinutes(5));

// Cache hit → Option.some(user)
const hit = await cache.get<User>('user:1');
hit.match({
  some: (user) => console.log(user.name), // Alice
  none: ()     => console.log('not found'),
});

// Write without TTL (no expiry)
await cache.set('config:theme', 'dark');

// Utility
await cache.has('user:1');         // true
await cache.delete('user:1');
const keys = await cache.keys('user:*');
```

### 2. Distributed Lock

```typescript
import { RedisLock, RedisLockError } from '@acme/cache-redis';

const lock = new RedisLock(client as unknown as RedisClientLike);

// Manual acquire / release
const acquired = await lock.acquire('order:42:process', 'worker-1', 30_000);
if (acquired) {
  try {
    // critical section
  } finally {
    await lock.release('order:42:process');
  }
}

// Convenience wrapper (auto-releases)
try {
  const result = await lock.withLock('invoice:generate', async () => {
    return await generateInvoice();
  }, 15_000); // custom TTL ms
} catch (err) {
  if (err instanceof RedisLockError) {
    console.error('Lock unavailable:', err.message);
  }
}
```

### 3. Pub/Sub

ioredis requires **separate connections** for subscribe mode — one for commands,
one for subscriptions.

```typescript
import Redis from 'ioredis';
import { RedisPubSub } from '@acme/cache-redis';
import type { RedisClientLike, RedisPubSubClientLike } from '@acme/cache-redis';

const publisher  = new Redis() as unknown as RedisClientLike;
const subscriber = new Redis() as unknown as RedisPubSubClientLike;

const pubSub = new RedisPubSub(publisher, subscriber);

// Subscribe
await pubSub.subscribe('user-events', (message) => {
  const event = JSON.parse(message) as UserCreatedEvent;
  console.log('Received:', event);
});

// Publish (returns subscriber count)
const count = await pubSub.publish('user-events', JSON.stringify({ type: 'UserCreated', id: 42 }));

// Unsubscribe specific handler
await pubSub.unsubscribe('user-events', myHandler);

// Unsubscribe all handlers for channel
await pubSub.unsubscribe('user-events');
```

### 4. Connection Health Check

```typescript
import { RedisConnection } from '@acme/cache-redis';

const connection = new RedisConnection(client as unknown as RedisClientLike);

const health = await connection.healthCheck();
// { status: 'ok', latencyMs: 2 }
// { status: 'error', latencyMs: 5, message: 'connect ECONNREFUSED' }

if (health.status === 'error') {
  logger.warn('Redis unavailable', { latencyMs: health.latencyMs, message: health.message });
}

await connection.quit(); // graceful shutdown
```

---

## NestJS Integration

```typescript
import { Module }          from '@nestjs/common';
import Redis               from 'ioredis';
import { RedisCache, RedisConnection } from '@acme/cache-redis';
import type { RedisClientLike }        from '@acme/cache-redis';

@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => new Redis(process.env.REDIS_URL),
    },
    {
      provide: RedisCache,
      inject: ['REDIS_CLIENT'],
      useFactory: (client: Redis) =>
        new RedisCache(client as unknown as RedisClientLike),
    },
    {
      provide: RedisConnection,
      inject: ['REDIS_CLIENT'],
      useFactory: (client: Redis) =>
        new RedisConnection(client as unknown as RedisClientLike),
    },
  ],
  exports: [RedisCache, RedisConnection],
})
export class RedisCacheModule {}
```

---

## API Reference

### `RedisCache`

| Method | Signature | Description |
|--------|-----------|-------------|
| `get<T>` | `(key: string) → Promise<Option<T>>` | `Option.some(value)` on hit, `Option.none()` on miss |
| `set<T>` | `(key, value, ttl?: Duration) → Promise<void>` | Serializes to JSON; uses `PX` (ms precision) when TTL given |
| `delete` | `(key: string) → Promise<void>` | Removes key |
| `has` | `(key: string) → Promise<boolean>` | `EXISTS key > 0` |
| `keys` | `(pattern: string) → Promise<string[]>` | Pattern match (e.g. `user:*`) |

### `RedisLock`

| Method | Signature | Description |
|--------|-----------|-------------|
| `acquire` | `(lockKey, lockValue, ttlMs?) → Promise<boolean>` | `SET NX PX` — `true` if acquired |
| `release` | `(lockKey: string) → Promise<void>` | `DEL key` |
| `withLock<T>` | `(lockKey, work, ttlMs?) → Promise<T>` | Acquires, runs work, auto-releases; throws `RedisLockError` on failure |

Default TTL: **30 000 ms** (30 seconds).

### `RedisPubSub`

| Method | Signature | Description |
|--------|-----------|-------------|
| `subscribe` | `(channel, handler) → Promise<void>` | Issues `SUBSCRIBE` on first handler |
| `unsubscribe` | `(channel, handler?) → Promise<void>` | Removes handler; issues `UNSUBSCRIBE` when last |
| `publish` | `(channel, message) → Promise<number>` | Delegates to publisher; returns subscriber count |
| `handlerCount` | `(channel: string) → number` | Testing helper |

### `RedisConnection`

| Method | Signature | Description |
|--------|-----------|-------------|
| `healthCheck` | `() → Promise<RedisHealthCheck>` | PING + latency measurement |
| `quit` | `() → Promise<void>` | Graceful disconnect |
| `getClient` | `() → RedisClientLike` | Exposes underlying client |

### Type `RedisHealthCheck`

```typescript
interface RedisHealthCheck {
  readonly status:     'ok' | 'error';
  readonly latencyMs:  number;
  readonly message?:   string;   // present on error
}
```

### Interface `RedisClientLike`

```typescript
interface RedisClientLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...options: Array<string | number>): Promise<string | null>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  publish(channel: string, message: string): Promise<number>;
  ping(): Promise<string>;
  quit(): Promise<string>;
}
```

### Interface `RedisPubSubClientLike`

```typescript
interface RedisPubSubClientLike {
  subscribe(channel: string): Promise<unknown>;
  unsubscribe(channel: string): Promise<unknown>;
  on(event: 'message', listener: (channel: string, message: string) => void): this;
  quit(): Promise<string>;
}
```

---

## Package Structure

```
packages/cache-redis/
├── src/
│   ├── RedisClientLike.ts      ← Structural interfaces (no ioredis import)
│   ├── RedisCache.ts           ← Cache with Option<T> + Duration TTL
│   ├── RedisLock.ts            ← Distributed lock (SET NX PX)
│   ├── RedisPubSub.ts          ← Pub/Sub with in-process dispatch
│   ├── RedisConnection.ts      ← Health check + lifecycle
│   ├── index.ts                ← Public exports
│   └── cache-redis.test.ts     ← 19 unit tests
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Testing

```bash
pnpm --filter @acme/cache-redis test
```

All 19 tests are pure unit tests using `vi.fn()` mocks — no Redis server required.

| Suite | Tests |
|-------|-------|
| RedisCache | 7 |
| RedisLock | 4 |
| RedisPubSub | 4 |
| RedisConnection | 4 |
| **Total** | **19** |

---

## Design Notes

- **`Option<T>` for cache reads**: aligns with kernel semantics — callers handle miss explicitly
- **`Duration` TTL**: millisecond-precise (`PX`) rather than second-truncating (`EX`)
- **Two-connection pub/sub**: ioredis enters subscribe-only mode after `SUBSCRIBE`; `RedisPubSub` takes a dedicated subscriber connection and a separate publisher
- **Structural interfaces**: library is decoupled from `ioredis` — any compatible client works without re-export overhead

## Related Packages

| Package | Purpose |
|---------|---------|
| `@acme/kernel` | `Option<T>`, `Duration`, `Result<T,E>` |
| `@acme/persistence-prisma` | Prisma ORM adapter |
| `@acme/persistence-mongodb` | MongoDB native driver adapter |
| `@acme/messaging-kafka` | Kafka messaging adapter |
| `@acme/messaging-rabbitmq` | RabbitMQ messaging adapter |
