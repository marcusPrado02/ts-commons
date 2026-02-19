import type { LoggerPort } from '@acme/kernel';

/**
 * Decorator that probabilistically samples log calls.
 *
 * Reduces log volume in high-throughput services by only forwarding a
 * fraction of `debug`, `info`, and `warn` messages.
 * **Errors are always forwarded** — sampling never silences errors.
 *
 * @param sampleRate A value in `[0, 1]`.
 *   `1.0` = log every message, `0.0` = drop all sampled levels.
 * @param random Injectable random function (defaults to `Math.random`).
 *   Inject a deterministic function in tests.
 *
 * @example
 * ```typescript
 * // Log only 10 % of debug/info/warn messages:
 * const logger = new SamplingLogger(innerLogger, 0.1);
 * ```
 */
export class SamplingLogger implements LoggerPort {
  constructor(
    private readonly inner: LoggerPort,
    private readonly sampleRate: number,
    private readonly random: () => number = Math.random,
  ) {}

  private shouldLog(): boolean {
    return this.random() < this.sampleRate;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog()) {
      this.inner.debug(message, context);
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog()) {
      this.inner.info(message, context);
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog()) {
      this.inner.warn(message, context);
    }
  }

  /** Errors are always forwarded — never subject to sampling. */
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.inner.error(message, error, context);
  }
}
