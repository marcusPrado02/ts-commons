/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-namespace */
/**
 * ESLint rules disabled for this file because Express types contain 'any'
 * at the framework boundary. The namespace is required to extend Express Request type.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { CorrelationId } from '@acme/kernel';
import type { Logger } from '@acme/observability';

/**
 * Request extension to include correlation context
 */
declare global {
  namespace Express {
    interface Request {
      correlationId?: CorrelationId;
    }
  }
}

/**
 * Middleware to create or extract correlation ID from requests
 *
 * This middleware ensures that every request has a correlation ID for tracing.
 * It looks for the ID in headers (X-Correlation-ID) or generates a new one.
 *
 * @param logger - Optional logger to record correlation ID creation
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { correlationMiddleware } from '@acme/web-express';
 *
 * const app = express();
 * app.use(correlationMiddleware());
 * ```
 */
export function correlationMiddleware(logger?: Logger): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Extract from header or generate new
      const correlationIdValue = req.headers['x-correlation-id'] as string | undefined;

      const correlationId =
        typeof correlationIdValue === 'string' && correlationIdValue.length > 0
          ? CorrelationId.fromString(correlationIdValue)
          : ({ value: crypto.randomUUID() } as CorrelationId);

      // Attach to request
      req.correlationId = correlationId;

      // Set response header
      res.setHeader('X-Correlation-ID', correlationId.value);

      // Log if logger provided
      if (logger !== undefined) {
        logger.debug('Correlation ID attached to request', {
          correlationId: correlationId.value,
          method: req.method,
          path: req.path,
        });
      }

      next();
    } catch (error) {
      // Fallback: create new correlation ID on error
      const fallbackId = { value: crypto.randomUUID() } as CorrelationId;
      req.correlationId = fallbackId;
      res.setHeader('X-Correlation-ID', fallbackId.value);

      if (logger !== undefined) {
        logger.warn('Failed to extract correlation ID, generated new one', {
          error: error instanceof Error ? error.message : String(error),
          correlationId: fallbackId.value,
        });
      }

      next();
    }
  };
}
