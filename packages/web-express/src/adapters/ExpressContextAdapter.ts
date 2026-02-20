import type { Request, NextFunction } from 'express';
import type { CorrelationId, TenantId } from '@acme/kernel';
import type { UseCaseContext } from '@acme/application';

/**
 * User information for context
 */
export interface ExpressUserContext {
  userId?: string;
  email?: string;
  roles?: readonly string[];
  permissions?: readonly string[];
}

/**
 * Express request extension for user context
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: ExpressUserContext;
      tenantId?: TenantId;
    }
  }
}

/**
 * Adapter to create use case context from Express request
 *
 * This adapter extracts context information from Express requests
 * and converts it to the UseCaseContext format required by the application layer.
 *
 * @example
 * ```typescript
 * import { ExpressContextAdapter } from '@acme/web-express';
 *
 * app.use((req, res, next) => {
 *   const context = ExpressContextAdapter.fromRequest(req);
 *   req.useCaseContext = context;
 *   next();
 * });
 * ```
 */
export class ExpressContextAdapter {
  /**
   * Create use case context from Express request
   */
  static fromRequest(
    req: Request,
  ): Omit<UseCaseContext, 'tenantId' | 'userId'> & { tenantId?: TenantId; userId?: string } {
    // Extract correlation ID (should be set by correlationMiddleware)
    const correlationId = req.correlationId ?? ({ value: crypto.randomUUID() } as CorrelationId);

    // Extract tenant ID if present
    const tenantId = req.tenantId;

    // Extract user information
    const userInfo = req.user;

    // Build metadata
    const metadata: Record<string, unknown> = {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };

    // Add user info to metadata if available
    if (userInfo !== undefined) {
      metadata['user'] = {
        id: userInfo.userId,
        email: userInfo.email,
        roles: userInfo.roles,
      };
    }

    // Add tenant info if available
    if (tenantId !== undefined) {
      metadata['tenantId'] = tenantId.value;
    }

    return {
      correlationId,
      metadata,
    } as unknown as Omit<UseCaseContext, 'tenantId' | 'userId'> & {
      tenantId?: TenantId;
      userId?: string;
    };
  }

  /**
   * Extract tenant ID from request header
   *
   * @param req - Express request
   * @param headerName - Name of header containing tenant ID (default: 'X-Tenant-ID')
   * @returns Tenant ID if present
   */
  static extractTenantId(req: Request, headerName: string = 'X-Tenant-ID'): TenantId | undefined {
    const tenantIdValue = req.get(headerName);
    if (tenantIdValue === undefined || tenantIdValue === '') {
      return undefined;
    }

    // Assuming TenantId has a fromString method
    return { value: tenantIdValue } as TenantId;
  }

  /**
   * Middleware to attach use case context to request
   *
   * @example
   * ```typescript
   * app.use(ExpressContextAdapter.contextMiddleware());
   * ```
   */
  static contextMiddleware() {
    return (req: Request, _res: unknown, next: NextFunction): void => {
      // Extract tenant ID from header if present
      const extractedTenantId = ExpressContextAdapter.extractTenantId(req);
      if (extractedTenantId !== undefined) {
        req.tenantId = extractedTenantId;
      }

      // Context will be created on-demand when needed
      next();
    };
  }
}

/** Extract a string field from a JWT payload by key */
function extractStringField(payload: Record<string, unknown>, key: string): string | undefined {
  const val = payload[key];
  return key in payload && typeof val === 'string' ? val : undefined;
}

/**
 * Helper to extract user context from JWT or session
 *
 * @example
 * ```typescript
 * app.use((req, res, next) => {
 *   // After JWT verification
 *   if (req.jwt) {
 *     req.user = extractUserFromJWT(req.jwt);
 *   }
 *   next();
 * });
 * ```
 */
export function extractUserFromJWT(jwt: unknown): ExpressUserContext {
  if (typeof jwt !== 'object' || jwt === null) {
    return {};
  }

  const payload = jwt as Record<string, unknown>;
  const result: Partial<ExpressUserContext> = {};

  const userId = extractStringField(payload, 'sub');
  if (userId !== undefined) {
    result.userId = userId;
  }

  const email = extractStringField(payload, 'email');
  if (email !== undefined) {
    result.email = email;
  }

  if ('roles' in payload && Array.isArray(payload['roles'])) {
    result.roles = payload['roles'] as string[];
  }
  if ('permissions' in payload && Array.isArray(payload['permissions'])) {
    result.permissions = payload['permissions'] as string[];
  }

  return result;
}
