import { AppError } from './AppError';
import type { AppErrorCode } from './AppErrorCode';

/**
 * Error that can be retried.
 */
export class RetryableError extends AppError {
  constructor(message: string, code: AppErrorCode, cause?: Error) {
    super(message, code, true, cause);
    this.name = 'RetryableError';
  }
}
