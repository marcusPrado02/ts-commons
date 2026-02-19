import type { LoggerPort } from '@acme/kernel';

/**
 * Decorator that measures and logs the wall-clock duration of async operations.
 *
 * On success, emits an `info` log with the elapsed duration.
 * On failure, emits an `error` log with the error and duration, then re-throws.
 *
 * @example
 * ```typescript
 * const perf = new PerformanceLogger(logger);
 *
 * const user = await perf.measure('fetchUser', () => userRepo.findById(id));
 * // → info: 'fetchUser completed' { durationMs: 42 }
 * ```
 */
export class PerformanceLogger {
  constructor(private readonly logger: LoggerPort) {}

  async measure<T>(operationName: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const durationMs = Date.now() - start;
      this.logger.info(`${operationName} completed`, { durationMs });
      return result;
    } catch (err) {
      const durationMs = Date.now() - start;
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`${operationName} failed`, error, { durationMs });
      throw err;
    }
  }
}
