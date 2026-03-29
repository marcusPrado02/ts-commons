import type { CorrelationId, TenantId, RequestId } from '@marcusprado02/kernel';

/**
 * Context carried through use case execution.
 */
export interface UseCaseContext {
  readonly correlationId: CorrelationId;
  readonly requestId: RequestId;
  readonly tenantId?: TenantId;
  readonly userId?: string;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}
