import type { FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import type { Logger } from '@acme/observability';

// Local error types for validation
class ValidationError extends Error {
  constructor(message: string, public errors?: Array<{ field: string; message: string }>) {
    super(message);
    this.name = 'ValidationError';
  }
}

class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

/**
 * Error handler hook for Fastify
 *
 * Converts domain errors to RFC 7807 Problem Details format.
 * Logs errors and maps them to appropriate HTTP status codes.
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import { errorHandlerHook } from '@acme/web-fastify';
 *
 * const app = Fastify();
 * app.setErrorHandler(errorHandlerHook(logger));
 * ```
 */
export function errorHandlerHook(logger: Logger) {
  return async (
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const correlationId = request.headers['x-correlation-id'] as string | undefined;

    // Map error to status code
    let statusCode = error.statusCode || 500;
    let problemType = 'about:blank';
    let title = 'Internal Server Error';

    if (error.name === 'ValidationError' || error instanceof ValidationError) {
      statusCode = 400;
      problemType = 'validation-error';
      title = 'Validation Error';
    } else if (error.name === 'DomainError' || error instanceof DomainError) {
      statusCode = 422;
      problemType = 'domain-error';
      title = 'Domain Error';
    } else if (error.statusCode === 404) {
      problemType = 'not-found';
      title = 'Not Found';
    }

    // Log error
    const logMethod = statusCode >= 500 ? 'error' : 'warn';
    (logger[logMethod] as (message: string, data?: unknown) => void)(
      `HTTP ${statusCode} error: ${error.message}`,
      {
        correlationId,
        statusCode,
        error: error.message,
        stack: error.stack,
      }
    );

    // Send Problem Details response
    await reply.status(statusCode).send({
      type: problemType,
      title,
      status: statusCode,
      detail: error.message,
      instance: request.url,
      correlationId,
    });
  };
}
