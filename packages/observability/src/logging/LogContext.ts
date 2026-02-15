/**
 * Logging context with correlation/tracing info.
 */
export interface LogContext {
  correlationId?: string;
  causationId?: string;
  traceId?: string;
  spanId?: string;
  tenantId?: string;
  userId?: string;
  [key: string]: unknown;
}
