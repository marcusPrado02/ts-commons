/**
 * Structural interfaces for Redis clients.
 *
 * These interfaces match the shape of `ioredis` (v5+) clients without importing
 * the `ioredis` package directly, keeping this library independent of generated
 * driver types.  Cast your ioredis instance at the infrastructure boundary:
 *
 * ```typescript
 * import Redis from 'ioredis';
 * const client = new Redis() as unknown as RedisClientLike;
 * const subscriber = new Redis() as unknown as RedisPubSubClientLike;
 * ```
 */

/**
 * Structural interface for a standard Redis client.
 * Supports get, set (with variadic options for EX/PX/NX), del, exists, keys, ping, quit.
 *
 * For ioredis, all of the following call signatures are valid via the variadic options:
 * - `set(key, value)` — persist without TTL
 * - `set(key, value, 'PX', ms)` — persist with millisecond TTL
 * - `set(key, value, 'EX', secs)` — persist with second TTL
 * - `set(key, value, 'NX', 'PX', ms)` — atomic set-if-not-exists (used by distributed lock)
 */
export interface RedisClientLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...options: Array<string | number>): Promise<string | null>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  publish(channel: string, message: string): Promise<number>;
  ping(): Promise<string>;
  quit(): Promise<string>;
}

/**
 * Structural interface for a Redis client dedicated to pub/sub.
 *
 * In ioredis, a connection that has issued SUBSCRIBE enters subscriber mode and
 * can only send subscribe-family commands.  Create a **separate** Redis instance
 * for this role.
 */
export interface RedisPubSubClientLike {
  subscribe(channel: string): Promise<unknown>;
  unsubscribe(channel: string): Promise<unknown>;
  /** Called by the driver when a message arrives on any subscribed channel. */
  on(event: 'message', listener: (channel: string, message: string) => void): this;
  quit(): Promise<string>;
}
