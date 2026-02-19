import type { LoggerPort } from '@acme/kernel';
import { LogLevel } from './LogLevel';

/**
 * Decorator that suppresses log calls whose level is below `minLevel`.
 *
 * Useful for runtime log-level control without touching the underlying
 * logger implementation.
 *
 * @example
 * ```typescript
 * const logger = new LevelFilterLogger(innerLogger, LogLevel.WARN);
 * logger.debug('ignored');  // suppressed
 * logger.warn('visible');   // forwarded
 * ```
 */
export class LevelFilterLogger implements LoggerPort {
  constructor(
    private readonly inner: LoggerPort,
    private minLevel: LogLevel,
  ) {}

  /** Change the minimum level at runtime without rebuilding the logger chain. */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.minLevel <= LogLevel.DEBUG) {
      this.inner.debug(message, context);
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (this.minLevel <= LogLevel.INFO) {
      this.inner.info(message, context);
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (this.minLevel <= LogLevel.WARN) {
      this.inner.warn(message, context);
    }
  }

  /** Errors are always forwarded regardless of `minLevel`. */
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.inner.error(message, error, context);
  }
}
