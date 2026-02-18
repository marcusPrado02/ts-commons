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
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      return this.extractUserFromJWT(token);
    }

    // Check for user in request (set by auth plugin)
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
      if (parts.length !== 3 || !parts[1]) return undefined;

      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64').toString('utf-8')
      );

      return {
        userId: payload.sub || payload.userId,
        tenantId: payload.tenantId,
        roles: payload.roles,
        permissions: payload.permissions,
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Create a hook that adds context to request
   */
  static contextHook() {
    return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
      const context = this.fromRequest(request);
      (request as FastifyRequest & { useCaseContext: typeof context }).useCaseContext = context;
    };
  }

  /**
   * Callback version of context hook
   */
  static contextHookCallback() {
    return (request: FastifyRequest, _reply: FastifyReply, done: HookHandlerDoneFunction): void => {
      const context = this.fromRequest(request);
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
