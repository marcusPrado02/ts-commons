import type { NotificationChannel, RateLimitConfig } from './NotificationTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function windowKey(channel: NotificationChannel, userId: string): string {
  return `${channel}::${userId}`;
}

function pruneOldTimestamps(timestamps: number[], windowMs: number, now: number): number[] {
  return timestamps.filter((t) => now - t < windowMs);
}

// ---------------------------------------------------------------------------
// RateLimiter
// ---------------------------------------------------------------------------

/**
 * Sliding-window rate limiter keyed by (channel, userId).
 *
 * Call {@link isAllowed} before sending; call {@link record} after a successful
 * send to register the timestamp.
 *
 * @example
 * ```ts
 * const limiter = new RateLimiter({ windowMs: 60_000, maxCount: 5 });
 * if (limiter.isAllowed('sms', 'user-1')) {
 *   limiter.record('sms', 'user-1');
 *   await adapter.send(notification);
 * }
 * ```
 */
export class RateLimiter {
  private readonly windows = new Map<string, number[]>();

  constructor(private readonly config: RateLimitConfig) {}

  /**
   * Return `true` if the user is still within the allowed window for the channel.
   */
  isAllowed(channel: NotificationChannel, userId: string): boolean {
    const key = windowKey(channel, userId);
    const now = Date.now();
    const raw = this.windows.get(key) ?? [];
    const active = pruneOldTimestamps(raw, this.config.windowMs, now);
    return active.length < this.config.maxCount;
  }

  /**
   * Record a send timestamp for the given channel + user.
   * Should be called immediately after a successful or attempted send.
   */
  record(channel: NotificationChannel, userId: string): void {
    const key = windowKey(channel, userId);
    const now = Date.now();
    const raw = this.windows.get(key) ?? [];
    const active = pruneOldTimestamps(raw, this.config.windowMs, now);
    active.push(now);
    this.windows.set(key, active);
  }

  /**
   * Return the number of sends recorded within the current window for a user + channel.
   */
  getCount(channel: NotificationChannel, userId: string): number {
    const key = windowKey(channel, userId);
    const now = Date.now();
    const raw = this.windows.get(key) ?? [];
    return pruneOldTimestamps(raw, this.config.windowMs, now).length;
  }

  /** Clear all recorded timestamps. */
  reset(): void {
    this.windows.clear();
  }
}
