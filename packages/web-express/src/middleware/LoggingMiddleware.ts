import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { Logger } from '@acme/observability';

// Helper to cast logger methods to avoid TypeScript strict errors
const cast = <T>(fn: T): ((message: string, data?: unknown) => void) => fn as (message: string, data?: unknown) => void;

/**
 * Middleware to log HTTP requests and responses
 *
 * This middleware provides structured logging for all HTTP requests,
 * including request details, response status, and duration.
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

    // Log incoming request
    (logger.info as (message: string, data?: unknown) => void)('Incoming request', {
      httpMethod: req.method,
      path: req.path,
      query: req.query,
      correlationId: req.correlationId?.value,
      userAgent: req.get('user-agent'),
      ip: req.ip,
    });

    // Capture response finish event
    res.on('finish', () => {
      const duration = Date.now() - startTime;

      if (res.statusCode >= 500) {
        (logger.error as (message: string, data?: unknown) => void)('Request completed', {
          httpMethod: req.method,
          path: req.path,
          status: res.statusCode,
          duration: `${duration}ms`,
          correlationId: req.correlationId?.value,
          contentLength: res.get('content-length'),
        });
      } else if (res.statusCode >= 400) {
        (logger.warn as (message: string, data?: unknown) => void)('Request completed', {
          httpMethod: req.method,
          path: req.path,
          status: res.statusCode,
          duration: `${duration}ms`,
          correlationId: req.correlationId?.value,
          contentLength: res.get('content-length'),
        });
      } else {
        (logger.info as (message: string, data?: unknown) => void)('Request completed', {
          httpMethod: req.method,
          path: req.path,
          status: res.statusCode,
          duration: `${duration}ms`,
          correlationId: req.correlationId?.value,
          contentLength: res.get('content-length'),
        });
      }
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
  options: LoggingOptions = {}
): RequestHandler {
  const {
    logBody = false,
    logHeaders = false,
    excludePaths = [],
    maxBodySize = 1000,
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip excluded paths
    if (excludePaths.includes(req.path)) {
      next();
      return;
    }

    const startTime = Date.now();

    // Build request log data
    const requestData: Record<string, unknown> = {
      httpMethod: req.method,
      path: req.path,
      query: req.query,
      correlationId: req.correlationId?.value,
      ip: req.ip,
    };

    if (logHeaders && req.headers !== undefined) {
      requestData['headers'] = req.headers;
    }

    if (logBody && req.body !== undefined) {
      const bodyString = JSON.stringify(req.body);
      requestData['body'] = bodyString.length > maxBodySize
        ? `${bodyString.substring(0, maxBodySize)}... [truncated]`
        : req.body;
    }

    cast(logger.info)('Incoming request', requestData);

    // Capture response
    res.on('finish', () => {
      const duration = Date.now() - startTime;

      if (res.statusCode >= 500) {
        cast(logger.error)('Request completed', {
          httpMethod: req.method,
          path: req.path,
          status: res.statusCode,
          duration: `${duration}ms`,
          correlationId: req.correlationId?.value,
          contentLength: res.get('content-length'),
        });
      } else if (res.statusCode >= 400) {
        cast(logger.warn)('Request completed', {
          httpMethod: req.method,
          path: req.path,
          status: res.statusCode,
          duration: `${duration}ms`,
          correlationId: req.correlationId?.value,
          contentLength: res.get('content-length'),
        });
      } else {
        cast(logger.info)('Request completed', {
          httpMethod: req.method,
          path: req.path,
          status: res.statusCode,
          duration: `${duration}ms`,
          correlationId: req.correlationId?.value,
          contentLength: res.get('content-length'),
        });
      }
    });

    next();
  };
}
