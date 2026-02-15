import { AppError } from './AppError';
import type { AppErrorCode } from './AppErrorCode';

/**
 * Error that should not be retried.
 */
export class NonRetryableError extends AppError {
  constructor(message: string, code: AppErrorCode, cause?: Error) {
    super(message, code, false, cause);
    this.name = 'NonRetryableError';
  }
}
