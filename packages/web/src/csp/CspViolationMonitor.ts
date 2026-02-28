import type { CspViolationReport } from './types';

type ViolationHandler = (report: CspViolationReport) => void;

/**
 * Collects and dispatches CSP violation reports.
 * Attach handlers to react to violations (log, alert, analytics, etc.).
 */
export class CspViolationMonitor {
  private readonly handlers: ViolationHandler[] = [];
  private readonly reports: CspViolationReport[] = [];
  private readonly maxReports: number;

  constructor(maxReports = 1000) {
    this.maxReports = maxReports;
  }

  /** Register a handler to be called on each incoming violation. */
  onViolation(handler: ViolationHandler): () => void {
    this.handlers.push(handler);
    return () => {
      const idx = this.handlers.indexOf(handler);
      if (idx >= 0) this.handlers.splice(idx, 1);
    };
  }

  /** Report a new CSP violation (typically called from your report-uri endpoint). */
  report(raw: unknown): void {
    const violation = this.parseReport(raw);
    if (violation == null) return;

    if (this.reports.length >= this.maxReports) {
      this.reports.shift(); // evict oldest
    }
    this.reports.push(violation);

    for (const handler of this.handlers) {
      handler(violation);
    }
  }

  /** Get all stored violation reports. */
  getReports(): readonly CspViolationReport[] {
    return [...this.reports];
  }

  /** Get violations grouped by violated directive. */
  groupByDirective(): Map<string, CspViolationReport[]> {
    const map = new Map<string, CspViolationReport[]>();
    for (const r of this.reports) {
      const group = map.get(r.violatedDirective) ?? [];
      group.push(r);
      map.set(r.violatedDirective, group);
    }
    return map;
  }

  /** Clear all stored reports. */
  clear(): void {
    this.reports.length = 0;
  }

  get reportCount(): number {
    return this.reports.length;
  }

  private parseReport(raw: unknown): CspViolationReport | null {
    if (raw == null || typeof raw !== 'object') return null;
    const data = raw as Record<string, unknown>;

    // Support both direct object and { 'csp-report': {...} } envelope
    const inner = this.extractInner(data);
    return this.buildReport(inner);
  }

  private extractInner(data: Record<string, unknown>): Record<string, unknown> {
    const nested = data['csp-report'];
    if (nested != null && typeof nested === 'object') {
      return nested as Record<string, unknown>;
    }
    return data;
  }

  private buildReport(inner: Record<string, unknown>): CspViolationReport | null {
    const blockedUri = typeof inner['blocked-uri'] === 'string' ? inner['blocked-uri'] : '';
    const documentUri = typeof inner['document-uri'] === 'string' ? inner['document-uri'] : '';
    const effectiveDirective =
      typeof inner['effective-directive'] === 'string' ? inner['effective-directive'] : '';
    const originalPolicy =
      typeof inner['original-policy'] === 'string' ? inner['original-policy'] : '';
    const violatedDirective =
      typeof inner['violated-directive'] === 'string'
        ? inner['violated-directive']
        : effectiveDirective;

    if (!violatedDirective) return null;

    return {
      blockedUri,
      documentUri,
      effectiveDirective,
      originalPolicy,
      violatedDirective,
      ...(typeof inner['referrer'] === 'string' ? { referrer: inner['referrer'] } : {}),
      ...(typeof inner['status-code'] === 'number' ? { statusCode: inner['status-code'] } : {}),
    };
  }
}
