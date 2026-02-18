/**
 * Redis connection wrapper with health check and graceful shutdown.
 */
import type { RedisClientLike } from './RedisClientLike';

/** Result returned by `RedisConnection.healthCheck()`. */
export interface RedisHealthCheck {
  readonly status: 'ok' | 'error';
  readonly latencyMs: number;
  readonly message?: string;
}

/**
 * Thin wrapper around a `RedisClientLike` that adds:
 * - `healthCheck()` via PING with round-trip latency measurement
 * - `quit()` for graceful connection shutdown
 * - `getClient()` for advanced use-cases
 *
 * @example
 * ```typescript
 * const connection = new RedisConnection(
 *   new Redis(redisUrl) as unknown as RedisClientLike,
 * );
 *
 * const health = await connection.healthCheck();
 * console.log(health); // { status: 'ok', latencyMs: 1 }
 *
 * // On app shutdown
 * await connection.quit();
 * ```
 */
export class RedisConnection {
  constructor(private readonly client: RedisClientLike) {}

  /**
   * Perform a PING and measure round-trip latency.
   * Returns `{ status: 'ok', latencyMs }` on success and
   * `{ status: 'error', latencyMs, message }` on failure.
   */
  async healthCheck(): Promise<RedisHealthCheck> {
    const startMs = Date.now();
    try {
      await this.client.ping();
      return { status: 'ok', latencyMs: Date.now() - startMs };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: 'error', latencyMs: Date.now() - startMs, message };
    }
  }

  /**
   * Close the connection gracefully.
   * Call this during application shutdown to cleanly release the TCP connection.
   */
  async quit(): Promise<void> {
    await this.client.quit();
  }

  /**
   * Expose the underlying `RedisClientLike` for advanced use-cases
   * (e.g. pipeline / multi-exec, Lua scripts, raw commands).
   */
  getClient(): RedisClientLike {
    return this.client;
  }
}
