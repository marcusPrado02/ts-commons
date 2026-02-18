import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import type { Logger } from '@acme/observability';

export interface LoggingHookOptions {
  /**
   * Log level for request/response logging
   * @default 'info'
   */
  logLevel?: 'debug' | 'info' | 'warn';

  /**
   * Whether to log request body
   * @default false
   */
  logRequestBody?: boolean;

  /**
   * Whether to log response body
   * @default false
   */
  logResponseBody?: boolean;

  /**
   * Paths to exclude from logging
   */
  excludePaths?: string[];
}

/**
 * Logging hook for Fastify
 *
 * Logs HTTP requests and responses with structured data.
 * Tracks request duration and includes correlation ID.
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import { loggingHook } from '@acme/web-fastify';
 *
 * const app = Fastify();
 * app.addHook('onRequest', loggingHook(logger, { logLevel: 'info' }));
 * ```
 */
export function loggingHook(logger: Logger, options: LoggingHookOptions = {}) {
  const {
    logLevel = 'info',
    logRequestBody = false,
    excludePaths = ['/health', '/metrics'],
  } = options;

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Skip excluded paths
    if (excludePaths.includes(request.url)) {
      return;
    }

    const startTime = Date.now();

    // Log incoming request
    (logger[logLevel] as (message: string, data?: unknown) => void)(
      'HTTP Request',
      {
        httpMethod: request.method,
        path: request.url,
        correlationId: request.headers['x-correlation-id'],
        ...(logRequestBody && { body: request.body }),
      }
    );

    // Hook into response to log after completion
    reply.raw.on('finish', () => {
      const duration = Date.now() - startTime;
      const statusCode = reply.statusCode;

      (logger[logLevel] as (message: string, data?: unknown) => void)(
        'HTTP Response',
        {
          httpMethod: request.method,
          path: request.url,
          statusCode,
          duration,
          correlationId: request.headers['x-correlation-id'],
        }
      );
    });
  };
}

/**
 * Callback-based version for compatibility
 */
export function loggingHookCallback(logger: Logger, options: LoggingHookOptions = {}) {
  const {
    logLevel = 'info',
    excludePaths = ['/health', '/metrics'],
  } = options;

  return (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction): void => {
    if (excludePaths.includes(request.url)) {
      done();
      return;
    }

    const startTime = Date.now();

    (logger[logLevel] as (message: string, data?: unknown) => void)(
      'HTTP Request',
      {
        httpMethod: request.method,
        path: request.url,
        correlationId: request.headers['x-correlation-id'],
      }
    );

    reply.raw.on('finish', () => {
      const duration = Date.now() - startTime;
      (logger[logLevel] as (message: string, data?: unknown) => void)(
        'HTTP Response',
        {
          httpMethod: request.method,
          path: request.url,
          statusCode: reply.statusCode,
          duration,
          correlationId: request.headers['x-correlation-id'],
        }
      );
    });

    done();
  };
}
