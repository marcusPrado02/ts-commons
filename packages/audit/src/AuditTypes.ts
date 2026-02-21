/**
 * A single field change captured in an audit log entry.
 */
export interface AuditChange {
  readonly old: unknown;
  readonly new: unknown;
}

/**
 * A single immutable audit log entry.
 */
export interface AuditLog {
  readonly id: string;
  readonly timestamp: Date;
  readonly userId: string;
  readonly tenantId?: string;
  readonly action: string;
  readonly resource: string;
  readonly resourceId: string;
  readonly changes: Readonly<Record<string, AuditChange>>;
  readonly ip: string;
  readonly userAgent: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

/**
 * Parameters for creating a new audit log entry.
 * `id` and `timestamp` are generated automatically.
 */
export interface AuditLogInput {
  readonly userId: string;
  readonly tenantId?: string;
  readonly action: string;
  readonly resource: string;
  readonly resourceId: string;
  readonly changes?: Readonly<Record<string, AuditChange>>;
  readonly ip: string;
  readonly userAgent: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

/**
 * Filters for querying audit logs.
 * All fields are optional — omitting a field means "no filter on that field".
 */
export interface AuditQuery {
  readonly userId?: string;
  readonly tenantId?: string;
  readonly action?: string;
  readonly resource?: string;
  readonly resourceId?: string;
  readonly fromDate?: Date;
  readonly toDate?: Date;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Aggregated summary over a set of audit log entries.
 */
export interface ComplianceReport {
  readonly generatedAt: Date;
  readonly period: { readonly from: Date; readonly to: Date };
  readonly totalEvents: number;
  readonly byAction: Readonly<Record<string, number>>;
  readonly byUser: Readonly<Record<string, number>>;
  readonly byResource: Readonly<Record<string, number>>;
}
