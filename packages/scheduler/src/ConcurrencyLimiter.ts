/**
 * Tracks per-key concurrency counts and enforces a configured maximum.
 *
 * @example
 * ```ts
 * const limiter = new ConcurrencyLimiter(2);
 * limiter.acquire('job-a');
 * limiter.isAllowed('job-a');  // true (1 < 2)
 * limiter.acquire('job-a');
 * limiter.isAllowed('job-a');  // false (2 >= 2)
 * limiter.release('job-a');
 * limiter.isAllowed('job-a');  // true (1 < 2)
 * ```
 */
export class ConcurrencyLimiter {
  private readonly counts = new Map<string, number>();

  constructor(private readonly maxConcurrency: number) {}

  /** Whether a new execution for `key` is permitted given the current count. */
  isAllowed(key: string): boolean {
    return this.getCount(key) < this.maxConcurrency;
  }

  /** Increment the active count for `key`. Call before starting an execution. */
  acquire(key: string): void {
    this.counts.set(key, this.getCount(key) + 1);
  }

  /** Decrement the active count for `key`. Call after an execution finishes. */
  release(key: string): void {
    const current = this.getCount(key);
    if (current > 0) this.counts.set(key, current - 1);
  }

  /** Return the number of currently active executions for `key`. */
  getCount(key: string): number {
    return this.counts.get(key) ?? 0;
  }

  /** Reset all counters. */
  reset(): void {
    this.counts.clear();
  }
}
