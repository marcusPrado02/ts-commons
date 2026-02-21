import type { AuditLog, AuditQuery } from './AuditTypes.js';

/**
 * Port interface that all audit storage backends must implement.
 */
export interface AuditStoragePort {
  /**
   * Persist a single audit log entry.
   */
  store(log: AuditLog): Promise<void>;

  /**
   * Retrieve audit log entries matching the given query.
   * Implementations should apply `offset` and `limit` after filtering.
   */
  query(query: AuditQuery): Promise<ReadonlyArray<AuditLog>>;

  /**
   * Count audit log entries matching the given query (ignoring limit/offset).
   */
  count(query: AuditQuery): Promise<number>;

  /**
   * Returns `true` when the backend storage is reachable.
   */
  checkHealth(): Promise<boolean>;
}
