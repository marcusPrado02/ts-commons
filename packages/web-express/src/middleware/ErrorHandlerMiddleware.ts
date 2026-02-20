/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/**
 * ESLint rules disabled for this file because Express types contain 'any'
 * at the framework boundary. This is acceptable as we provide type safety
 * at the application layer above.
 */

import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import type { Logger } from '@acme/observability';

/**
 * Error codes for different error types
 */
const ERROR_STATUS_MAP: Record<string, number> = {
  ValidationError: 400,
  NotFoundError: 404,
  UnauthorizedError: 401,
  ForbiddenError: 403,
  ConflictError: 409,
  TooManyRequestsError: 429,
  InternalServerError: 500,
};

/**
 * Middleware to handle errors and convert them to Problem Details (RFC 7807)
 *
 * This middleware centrally handles all errors in Express applications,
 * converting them to standardized Problem Details responses.
 *
 * @param logger - Optional logger to record errors
 * @returns Express error handler middleware
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { errorHandlerMiddleware } from '@acme/web-express';
 *
 * const app = express();
 * // Register as last middleware
 * app.use(errorHandlerMiddleware(logger));
 * ```
 */
/** Log an error at the appropriate severity based on status code */
function logError(
  logger: Logger,
  error: Error,
  status: number,
  req: Request,
  correlationId: string | undefined,
): void {
  const data = {
    errorName: error.name,
    message: error.message,
    status,
    httpMethod: req.method,
    path: req.path,
    correlationId,
  };
  if (status >= 500) {
    (logger.error as (message: string, data?: unknown) => void)('Request failed with error', {
      ...data,
      stack: error.stack,
    });
  } else {
    (logger.warn as (message: string, data?: unknown) => void)('Request failed with error', data);
  }
}

export function errorHandlerMiddleware(logger?: Logger): ErrorRequestHandler {
  return (error: Error, req: Request, res: Response, next: NextFunction): void => {
    if (res.headersSent === true) {
      next(error);
      return;
    }
    const status = determineStatusCode(error);
    const correlationId = req.correlationId?.value;
    const problemDetails = {
      type: `https://api.acme.com/errors/${error.name}`,
      title: error.name,
      status,
      detail: error.message,
      instance: req.url,
    };
    const response =
      typeof correlationId === 'string' && correlationId.length > 0
        ? { ...problemDetails, correlationId }
        : problemDetails;
    if (logger !== undefined) {
      logError(logger, error, status, req, correlationId);
    }
    res.status(status).json(response);
  };
}

/**
 * Determine HTTP status code from error
 */
function determineStatusCode(error: Error): number {
  // Check if error has status property
  if ('status' in error && typeof error.status === 'number') {
    return error.status;
  }

  // Check if error has statusCode property
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    return error.statusCode;
  }

  // Map by error name
  const mappedStatus = ERROR_STATUS_MAP[error.name];
  if (mappedStatus !== undefined) {
    return mappedStatus;
  }

  // Default to 500 Internal Server Error
  return 500;
}

/**
 * Helper to register error handler as last middleware
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { registerErrorHandler } from '@acme/web-express';
 *
 * const app = express();
 * // ... other middleware and routes
 * registerErrorHandler(app, logger);
 * ```
 */
export function registerErrorHandler(
  app: { use: (handler: ErrorRequestHandler) => void },
  logger?: Logger,
): void {
  app.use(errorHandlerMiddleware(logger));
}
