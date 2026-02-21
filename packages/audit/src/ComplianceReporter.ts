import type { AuditLog, ComplianceReport } from './AuditTypes.js';
import type { AuditStoragePort } from './AuditPort.js';

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

/**
 * Generates compliance reports from a set of audit log entries.
 */
export class ComplianceReporter {
  /**
   * Builds a `ComplianceReport` from a pre-loaded array of audit logs.
   * All entries in `logs` are included regardless of their timestamp.
   */
  generate(
    logs: ReadonlyArray<AuditLog>,
    period: { readonly from: Date; readonly to: Date },
  ): ComplianceReport {
    const byAction: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    const byResource: Record<string, number> = {};

    for (const log of logs) {
      increment(byAction, log.action);
      increment(byUser, log.userId);
      increment(byResource, log.resource);
    }

    return {
      generatedAt: new Date(),
      period,
      totalEvents: logs.length,
      byAction,
      byUser,
      byResource,
    };
  }

  /**
   * Queries the storage for logs in the given period and builds a report.
   */
  async generateFromStorage(
    storage: AuditStoragePort,
    period: { readonly from: Date; readonly to: Date },
  ): Promise<ComplianceReport> {
    const logs = await storage.query({ fromDate: period.from, toDate: period.to });
    return this.generate(logs, period);
  }
}
