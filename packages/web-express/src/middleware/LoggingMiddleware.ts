/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/**
 * ESLint rules disabled for this file because Express types contain 'any'
 * at the framework boundary (Request, Response). This is acceptable as we
 * provide type safety at the application layer above.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { Logger } from '@acme/observability';

// Helper to cast logger methods to avoid TypeScript strict errors
const cast = <T>(fn: T): ((message: string, data?: unknown) => void) =>
  fn as (message: string, data?: unknown) => void;

/** Log a completed HTTP response at the appropriate severity level */
function logResponse(logger: Logger, req: Request, res: Response, startTime: number): void {
  const duration = Date.now() - startTime;
  const data = {
    httpMethod: req.method,
    path: req.path,
    status: res.statusCode,
    duration: `${duration}ms`,
    correlationId: req.correlationId?.value,
    contentLength: res.get('content-length'),
  };
  if (res.statusCode >= 500) {
    cast(logger.error.bind(logger))('Request completed', data);
  } else if (res.statusCode >= 400) {
    cast(logger.warn.bind(logger))('Request completed', data);
  } else {
    cast(logger.info.bind(logger))('Request completed', data);
  }
}

/**
 * Middleware to log HTTP requests and responses
 *
 * @param logger - Logger instance for recording requests
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { loggingMiddleware } from '@acme/web-express';
 * import { createLogger } from '@acme/observability';
 *
 * const app = express();
 * const logger = createLogger('http');
 * app.use(loggingMiddleware(logger));
 * ```
 */
export function loggingMiddleware(logger: Logger): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    cast(logger.info.bind(logger))('Incoming request', {
      httpMethod: req.method,
      path: req.path,
      query: req.query,
      correlationId: req.correlationId?.value,
      userAgent: req.get('user-agent'),
      ip: req.ip,
    });
    res.on('finish', () => {
      logResponse(logger, req, res, startTime);
    });
    next();
  };
}

/**
 * Options for configuring logging middleware
 */
export interface LoggingOptions {
  /**
   * Whether to log request body (default: false for security)
   */
  readonly logBody?: boolean;

  /**
   * Whether to log request headers (default: false for security)
   */
  readonly logHeaders?: boolean;

  /**
   * Paths to exclude from logging (e.g., health checks)
   */
  readonly excludePaths?: readonly string[];

  /**
   * Maximum body size to log in bytes (default: 1000)
   */
  readonly maxBodySize?: number;
}

/** Build request log data for advanced logging middleware */
function buildAdvancedRequestData(
  req: Request,
  logHeaders: boolean,
  logBody: boolean,
  maxBodySize: number,
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    httpMethod: req.method,
    path: req.path,
    query: req.query,
    correlationId: req.correlationId?.value,
    ip: req.ip,
  };
  if (logHeaders) {
    data['headers'] = req.headers;
  }
  if (logBody && req.body !== undefined) {
    const bodyString = JSON.stringify(req.body);
    data['body'] =
      bodyString.length > maxBodySize
        ? `${bodyString.substring(0, maxBodySize)}... [truncated]`
        : req.body;
  }
  return data;
}

/**
 * Advanced logging middleware with options
 *
 * @example
 * ```typescript
 * app.use(advancedLoggingMiddleware(logger, {
 *   logBody: true,
 *   excludePaths: ['/health', '/metrics'],
 *   maxBodySize: 500
 * }));
 * ```
 */
export function advancedLoggingMiddleware(
  logger: Logger,
  options: LoggingOptions = {},
): RequestHandler {
  const { logBody = false, logHeaders = false, excludePaths = [], maxBodySize = 1000 } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    if (excludePaths.includes(req.path)) {
      next();
      return;
    }
    const startTime = Date.now();
    const requestData = buildAdvancedRequestData(req, logHeaders, logBody, maxBodySize);
    cast(logger.info.bind(logger))('Incoming request', requestData);
    res.on('finish', () => {
      logResponse(logger, req, res, startTime);
    });
    next();
  };
}
