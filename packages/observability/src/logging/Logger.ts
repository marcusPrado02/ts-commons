import type { LoggerPort } from '@acme/kernel';
import type { LogContext } from './LogContext';

/**
 * Structured logger implementation.
 */
export class Logger implements LoggerPort {
  constructor(
    private readonly serviceName: string,
    private readonly context: LogContext = {},
  ) {}

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    const errorContext = error
      ? {
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          },
        }
      : {};
    this.log('error', message, { ...context, ...errorContext });
  }

  private log(level: string, message: string, context?: Record<string, unknown>): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      ...this.context,
      ...context,
    };

    // In production, this would use a proper logging library
    console.log(JSON.stringify(logEntry));
  }

  withContext(additionalContext: LogContext): Logger {
    return new Logger(this.serviceName, { ...this.context, ...additionalContext });
  }
}
