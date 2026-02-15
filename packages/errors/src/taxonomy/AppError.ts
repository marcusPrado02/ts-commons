import type { AppErrorCode } from './AppErrorCode';

/**
 * Application-level error.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: AppErrorCode,
    public readonly retryable: boolean = false,
    cause?: Error,
  ) {
    super(message, { cause });
    this.name = 'AppError';
  }
}
