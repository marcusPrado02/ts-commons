/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * ESLint rules disabled for this file because Fastify types contain 'any'
 * at the framework boundary. This is acceptable as we provide type safety
 * at the application layer above.
 */

import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';

/**
 * User context extracted from request
 */
export interface FastifyUserContext {
  userId: string;
  tenantId?: string;
  roles?: string[];
  permissions?: string[];
}

/**
 * Context adapter for Fastify
 *
 * Extracts context information from Fastify requests:
 * - Correlation ID
 * - Tenant ID
 * - User authentication data
 *
 * @example
 * ```typescript
 * import { FastifyContextAdapter } from '@acme/web-fastify';
 *
 * // Extract context in route handler
 * app.get('/users', async (request, reply) => {
 *   const context = FastifyContextAdapter.fromRequest(request);
 *   console.log('Tenant:', context.tenantId);
 * });
 *
 * // Or use as decorator
 * app.decorateRequest('getUserContext', function() {
 *   return FastifyContextAdapter.extractUserContext(this);
 * });
 * ```
 */
export class FastifyContextAdapter {
  /**
   * Extract complete context from request
   */
  static fromRequest(request: FastifyRequest): {
    correlationId: string | undefined;
    tenantId: string | undefined;
    user: FastifyUserContext | undefined;
  } {
    return {
      correlationId: request.headers['x-correlation-id'] as string | undefined,
      tenantId: this.extractTenantId(request),
      user: this.extractUserContext(request),
    };
  }

  /**
   * Extract tenant ID from request headers
   */
  static extractTenantId(request: FastifyRequest): string | undefined {
    return request.headers['x-tenant-id'] as string | undefined;
  }

  /**
   * Extract user context from JWT or session
   */
  static extractUserContext(request: FastifyRequest): FastifyUserContext | undefined {
    // Check for JWT in Authorization header
    const authHeader = request.headers.authorization;
    if (
      typeof authHeader === 'string' &&
      authHeader.length > 0 &&
      authHeader.startsWith('Bearer ')
    ) {
      const token = authHeader.substring(7);
      return this.extractUserFromJWT(token);
    }

    // Check for user in request (set by auth plugin)
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    const requestWithUser = request as FastifyRequest & { user?: FastifyUserContext };
    return requestWithUser.user;
  }

  /**
   * Extract user from JWT token (basic implementation)
   */
  private static extractUserFromJWT(token: string): FastifyUserContext | undefined {
    try {
      // Basic JWT parsing (in production, use a proper JWT library)
      const parts = token.split('.');
      if (parts.length !== 3 || typeof parts[1] !== 'string' || parts[1].length === 0) {
        return undefined;
      }

      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64').toString('utf-8')
      );

      const userId = (typeof payload.sub === 'string' ? payload.sub : payload.userId) as string;
      const result: FastifyUserContext = { userId };

      if (typeof payload.tenantId === 'string') {
        result.tenantId = payload.tenantId;
      }
      if (Array.isArray(payload.roles)) {
        result.roles = payload.roles as string[];
      }
      if (Array.isArray(payload.permissions)) {
        result.permissions = payload.permissions as string[];
      }

      return result;
    } catch {
      return undefined;
    }
  }

  /**
   * Create a hook that adds context to request
   */
  static contextHook() {
    // eslint-disable-next-line @typescript-eslint/require-await
    return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
      const context = this.fromRequest(request);
      // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
      (request as FastifyRequest & { useCaseContext: typeof context }).useCaseContext = context;
    };
  }

  /**
   * Callback version of context hook
   */
  static contextHookCallback() {
    return (request: FastifyRequest, _reply: FastifyReply, done: HookHandlerDoneFunction): void => {
      const context = this.fromRequest(request);
      // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
      (request as FastifyRequest & { useCaseContext: typeof context }).useCaseContext = context;
      done();
    };
  }
}

/**
 * Augment FastifyRequest type to include use case context
 */
declare module 'fastify' {
  interface FastifyRequest {
    useCaseContext?: {
      correlationId: string | undefined;
      tenantId: string | undefined;
      user: FastifyUserContext | undefined;
    };
  }
}
