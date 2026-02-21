import type { AuditLog, AuditLogInput, AuditQuery } from './AuditTypes.js';
import type { AuditStoragePort } from './AuditPort.js';

let counter = 0;

function generateId(): string {
  counter += 1;
  return `audit-${Date.now().toString(36)}-${counter.toString(36)}`;
}

function buildLog(input: AuditLogInput): AuditLog {
  return {
    id: generateId(),
    timestamp: new Date(),
    userId: input.userId,
    action: input.action,
    resource: input.resource,
    resourceId: input.resourceId,
    changes: input.changes ?? {},
    ip: input.ip,
    userAgent: input.userAgent,
    ...(input.tenantId === undefined ? {} : { tenantId: input.tenantId }),
    ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
  };
}

/**
 * Core audit service. Builds audit log entries and delegates persistence
 * to the injected `AuditStoragePort`.
 */
export class AuditService {
  constructor(private readonly storage: AuditStoragePort) {}

  /**
   * Creates and persists a new audit log entry.
   * Returns the stored entry (with generated `id` and `timestamp`).
   */
  async log(input: AuditLogInput): Promise<AuditLog> {
    const entry = buildLog(input);
    await this.storage.store(entry);
    return entry;
  }

  /** Query stored audit entries. Delegates to the storage backend. */
  query(q: AuditQuery): Promise<ReadonlyArray<AuditLog>> {
    return this.storage.query(q);
  }

  /** Count stored audit entries matching a query. Delegates to the storage backend. */
  count(q: AuditQuery): Promise<number> {
    return this.storage.count(q);
  }

  /** Returns `true` when the underlying storage is healthy. */
  checkHealth(): Promise<boolean> {
    return this.storage.checkHealth();
  }
}
