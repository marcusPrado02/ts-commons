import { Logger } from './Logger';
import type { LogContext } from './LogContext';

/**
 * Factory for creating loggers.
 */
export class LoggerFactory {
  constructor(private readonly serviceName: string) {}

  create(context?: LogContext): Logger {
    return new Logger(this.serviceName, context);
  }
}
