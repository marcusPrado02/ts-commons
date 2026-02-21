// Client interfaces
export type { RedisClientLike, RedisPubSubClientLike } from './RedisClientLike';

// Cache
export { RedisCache } from './RedisCache';

// Distributed lock
export { RedisLock, RedisLockError } from './RedisLock';

// Pub/Sub
export { RedisPubSub } from './RedisPubSub';
export type { MessageHandler } from './RedisPubSub';

// Connection
export { RedisConnection } from './RedisConnection';
export type { RedisHealthCheck } from './RedisConnection';

// Caching strategies (Item 48)
export type { CachePort } from './strategies/CachePort';
export { InMemoryCache } from './strategies/InMemoryCache';
export type { InMemoryCacheOptions } from './strategies/InMemoryCache';
export { MultiLevelCache } from './strategies/MultiLevelCache';
export { CacheTagRegistry } from './strategies/CacheTagRegistry';
export { BloomFilter } from './strategies/BloomFilter';
export { CacheWarmer } from './strategies/CacheWarmer';
export type { WarmupItem, WarmupResult, WarmFn } from './strategies/CacheWarmer';
