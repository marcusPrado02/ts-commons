import type { ReconnectionConfig } from './types.js';

const DEFAULT_MAX_DELAY_MS = 30_000;

/**
 * Computes reconnection delays and enforces attempt limits.
 *
 * Supports three strategies:
 * - **fixed**: every attempt uses `baseDelayMs`
 * - **linear**: delay increases linearly — `attempt * baseDelayMs`
 * - **exponential**: delay doubles per attempt — `baseDelayMs * 2^attempt`, capped at `maxDelayMs`
 *
 * @example
 * ```ts
 * const handler = new ReconnectionHandler({ strategy: 'exponential', maxAttempts: 5, baseDelayMs: 1000 });
 * if (handler.shouldRetry(attempt)) {
 *   await sleep(handler.getNextDelay(attempt));
 * }
 * ```
 */
export class ReconnectionHandler {
  private readonly config: ReconnectionConfig;
  private attemptCount = 0;

  constructor(config: ReconnectionConfig) {
    this.config = config;
  }

  /**
   * Returns `true` if another reconnection attempt should be made.
   * Always `true` when `maxAttempts` is 0.
   */
  shouldRetry(attempt: number): boolean {
    if (this.config.maxAttempts === 0) return true;
    return attempt < this.config.maxAttempts;
  }

  /**
   * Computes the delay in milliseconds before the given attempt number.
   * Attempt numbers are 1-based (first retry = attempt 1).
   */
  getNextDelay(attempt: number): number {
    const { strategy, baseDelayMs, maxDelayMs = DEFAULT_MAX_DELAY_MS } = this.config;
    if (strategy === 'fixed') return baseDelayMs;
    if (strategy === 'linear') return attempt * baseDelayMs;
    // exponential
    const delay = baseDelayMs * Math.pow(2, attempt - 1);
    return Math.min(delay, maxDelayMs);
  }

  /**
   * Increments the internal attempt counter and returns the delay for this attempt.
   * Use {@link reset} to restart the sequence.
   */
  schedule(): number {
    this.attemptCount++;
    return this.getNextDelay(this.attemptCount);
  }

  /** Whether further retries are allowed given the current attempt count. */
  get canRetry(): boolean {
    return this.shouldRetry(this.attemptCount);
  }

  /** How many attempts have been scheduled so far. */
  get attempts(): number {
    return this.attemptCount;
  }

  /** Resets the attempt counter back to zero. */
  reset(): void {
    this.attemptCount = 0;
  }
}
