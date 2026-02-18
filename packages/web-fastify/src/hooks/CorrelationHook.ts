/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/**
 * ESLint rules disabled for this file because Fastify types contain 'any'
 * at the framework boundary. This is acceptable as we provide type safety
 * at the application layer above.
 */

import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { randomUUID } from 'node:crypto';

/**
 * Correlation ID hook for Fastify
 *
 * Extracts or generates a correlation ID for request tracing.
 * Stores the correlation ID in request headers for downstream propagation.
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import { correlationHook } from '@acme/web-fastify';
 *
 * const app = Fastify();
 * app.addHook('onRequest', correlationHook());
 * ```
 */
export function correlationHook(headerName = 'x-correlation-id') {
  // eslint-disable-next-line @typescript-eslint/require-await
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const existingId = request.headers[headerName] as string | undefined;
    const correlationId =
      typeof existingId === 'string' && existingId.length > 0 ? existingId : randomUUID();

    // Store in request headers for access in handlers
    request.headers[headerName] = correlationId;

    // Add to response headers
    reply.header(headerName, correlationId);
  };
}

/**
 * Legacy callback-based version for compatibility
 */
export function correlationHookCallback(headerName = 'x-correlation-id') {
  return (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction): void => {
    const existingId = request.headers[headerName] as string | undefined;
    const correlationId =
      typeof existingId === 'string' && existingId.length > 0 ? existingId : randomUUID();

    request.headers[headerName] = correlationId;
    reply.header(headerName, correlationId);

    done();
  };
}
