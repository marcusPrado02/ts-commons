import type { AuditChange } from './AuditTypes.js';
import type { AuditService } from './AuditService.js';

/**
 * Request context required when auditing a function call.
 */
export interface AuditContext {
  readonly userId: string;
  readonly ip: string;
  readonly userAgent: string;
  readonly tenantId?: string;
}

/**
 * Options that control how a wrapped function is audited.
 */
export interface AuditedOptions {
  /** The action name stored in the audit log (e.g. `'USER_CREATED'`). */
  readonly action: string;
  /** The resource type (e.g. `'User'`). */
  readonly resource: string;
  /**
   * Derives the `resourceId` from the function arguments.
   * Defaults to `'unknown'` if not provided.
   */
  readonly getResourceId?: (args: ReadonlyArray<unknown>) => string;
  /**
   * Overrides the `userId` taken from `AuditContext`.
   * Useful when the user identity is available in the arguments.
   */
  readonly getUserId?: (args: ReadonlyArray<unknown>) => string;
  /**
   * Captures field-level changes from the arguments and the function result.
   * Defaults to an empty changes map if not provided.
   */
  readonly getChanges?: (
    args: ReadonlyArray<unknown>,
    result: unknown,
  ) => Readonly<Record<string, AuditChange>>;
}

/**
 * Wraps an async function so that every successful call is recorded as an
 * audit log entry via the given `AuditService`.
 *
 * The original function is called first; the audit entry is written after a
 * successful return (failures are not audited).
 *
 * @example
 * ```typescript
 * const auditedCreate = createAuditedFn(
 *   createUser,
 *   auditService,
 *   { action: 'USER_CREATED', resource: 'User' },
 *   { userId: 'admin', ip: '127.0.0.1', userAgent: 'cli' },
 * );
 * await auditedCreate(newUserData);
 * ```
 */
export function createAuditedFn<T extends ReadonlyArray<unknown>, R>(
  fn: (...args: T) => Promise<R>,
  service: AuditService,
  options: AuditedOptions,
  context: AuditContext,
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const result = await fn(...args);
    const userId = options.getUserId?.(args) ?? context.userId;
    const resourceId = options.getResourceId?.(args) ?? 'unknown';
    const changes = options.getChanges?.(args, result) ?? {};
    await service.log({
      userId,
      action: options.action,
      resource: options.resource,
      resourceId,
      changes,
      ip: context.ip,
      userAgent: context.userAgent,
      ...(context.tenantId === undefined ? {} : { tenantId: context.tenantId }),
    });
    return result;
  };
}
