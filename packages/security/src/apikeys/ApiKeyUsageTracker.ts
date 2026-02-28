import type { ApiKeyUsageRecord, ApiKeyStats, RateLimitConfig } from './types';

interface WindowEntry {
  count: number;
  windowStart: number;
}

/**
 * In-memory usage tracker with sliding-window rate limiting per API key.
 */
export class ApiKeyUsageTracker {
  private readonly usage = new Map<string, ApiKeyUsageRecord[]>();
  private readonly rateWindows = new Map<string, WindowEntry>();

  constructor(private readonly rateLimitConfig?: RateLimitConfig) {}

  /**
   * Record a usage event for a key.
   */
  record(event: ApiKeyUsageRecord): void {
    const existing = this.usage.get(event.keyId) ?? [];
    existing.push(event);
    this.usage.set(event.keyId, existing);
  }

  /**
   * Check if a key is currently rate-limited (sliding window).
   * Returns true if the key should be blocked.
   */
  isRateLimited(keyId: string): boolean {
    if (this.rateLimitConfig == null) return false;
    const now = Date.now();
    const entry = this.rateWindows.get(keyId);
    if (entry == null) return false;
    if (now - entry.windowStart > this.rateLimitConfig.windowMs) return false;
    return entry.count >= this.rateLimitConfig.maxRequests;
  }

  /**
   * Increment the rate-limit counter for a key.
   */
  incrementRateCounter(keyId: string): void {
    if (this.rateLimitConfig == null) return;
    const now = Date.now();
    const entry = this.rateWindows.get(keyId);
    if (entry == null || now - entry.windowStart > this.rateLimitConfig.windowMs) {
      this.rateWindows.set(keyId, { count: 1, windowStart: now });
    } else {
      this.rateWindows.set(keyId, { count: entry.count + 1, windowStart: entry.windowStart });
    }
  }

  /**
   * Get aggregated stats for a key.
   */
  getStats(keyId: string): ApiKeyStats {
    const records = this.usage.get(keyId) ?? [];
    const sorted = [...records].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return {
      keyId,
      requestCount: records.length,
      lastUsedAt: sorted.length > 0 ? sorted[0].timestamp : undefined,
      rateLimited: this.isRateLimited(keyId),
    };
  }

  /**
   * Get raw usage records for a key, optionally filtered by time range.
   */
  getRecords(keyId: string, since?: Date): ApiKeyUsageRecord[] {
    const records = this.usage.get(keyId) ?? [];
    if (since == null) return [...records];
    return records.filter((r) => r.timestamp >= since);
  }

  /**
   * Clear all data for a key (e.g. after revocation).
   */
  clear(keyId: string): void {
    this.usage.delete(keyId);
    this.rateWindows.delete(keyId);
  }
}
