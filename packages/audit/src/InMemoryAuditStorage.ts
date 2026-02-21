import type { AuditLog, AuditQuery } from './AuditTypes.js';
import type { AuditStoragePort } from './AuditPort.js';

function matchesDateRange(timestamp: Date, from: Date | undefined, to: Date | undefined): boolean {
  if (from !== undefined && timestamp < from) return false;
  if (to !== undefined && timestamp > to) return false;
  return true;
}

function matchesScalar(logValue: string | undefined, filter: string | undefined): boolean {
  if (filter === undefined) return true;
  return logValue === filter;
}

function matchesLog(log: AuditLog, q: AuditQuery): boolean {
  if (!matchesScalar(log.userId, q.userId)) return false;
  if (!matchesScalar(log.tenantId, q.tenantId)) return false;
  if (!matchesScalar(log.action, q.action)) return false;
  if (!matchesScalar(log.resource, q.resource)) return false;
  if (!matchesScalar(log.resourceId, q.resourceId)) return false;
  return matchesDateRange(log.timestamp, q.fromDate, q.toDate);
}

/**
 * Volatile in-memory implementation of `AuditStoragePort`.
 * All stored entries are lost when the process exits.
 * Suitable for tests and local development.
 */
export class InMemoryAuditStorage implements AuditStoragePort {
  private readonly logs: AuditLog[] = [];

  store(log: AuditLog): Promise<void> {
    this.logs.push(log);
    return Promise.resolve();
  }

  query(query: AuditQuery): Promise<ReadonlyArray<AuditLog>> {
    const filtered = this.logs.filter((log) => matchesLog(log, query));
    const offset = query.offset ?? 0;
    const { limit } = query;
    const end = limit === undefined ? undefined : offset + limit;
    return Promise.resolve(filtered.slice(offset, end));
  }

  count(query: AuditQuery): Promise<number> {
    const total = this.logs.filter((log) => matchesLog(log, query)).length;
    return Promise.resolve(total);
  }

  checkHealth(): Promise<boolean> {
    return Promise.resolve(true);
  }

  /** Removes all stored entries. Useful in tests. */
  clear(): void {
    this.logs.splice(0, this.logs.length);
  }

  /** Returns the number of entries currently stored. */
  size(): number {
    return this.logs.length;
  }
}
