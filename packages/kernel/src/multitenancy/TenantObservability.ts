import type { TenantId } from '../identity/TenantId';

/**
 * A structured log entry enriched with tenant information.
 */
export interface TenantLogEntry {
  readonly tenantId: string;
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly message: string;
  readonly context?: Record<string, unknown>;
}

/**
 * A metrics sample associated with a tenant.
 */
export interface TenantMetricSample {
  readonly tenantId: string;
  readonly metric: string;
  readonly value: number;
  readonly tags?: Record<string, string>;
}

/**
 * Port for emitting structured, tenant-scoped log entries.
 */
export interface TenantLogger {
  log(tenantId: TenantId, entry: Omit<TenantLogEntry, 'tenantId'>): void;
}

/**
 * Port for recording tenant-scoped metrics (counters, gauges, histograms).
 */
export interface TenantMetrics {
  record(tenantId: TenantId, sample: Omit<TenantMetricSample, 'tenantId'>): void;
}

/**
 * In-memory implementation of {@link TenantLogger} — useful in tests.
 */
export class InMemoryTenantLogger implements TenantLogger {
  readonly entries: TenantLogEntry[] = [];

  log(tenantId: TenantId, entry: Omit<TenantLogEntry, 'tenantId'>): void {
    this.entries.push({ tenantId: tenantId.value, ...entry });
  }

  forTenant(tenantId: TenantId): TenantLogEntry[] {
    return this.entries.filter((e) => e.tenantId === tenantId.value);
  }
}

/**
 * In-memory implementation of {@link TenantMetrics} — useful in tests.
 */
export class InMemoryTenantMetrics implements TenantMetrics {
  readonly samples: TenantMetricSample[] = [];

  record(tenantId: TenantId, sample: Omit<TenantMetricSample, 'tenantId'>): void {
    this.samples.push({ tenantId: tenantId.value, ...sample });
  }

  forTenant(tenantId: TenantId): TenantMetricSample[] {
    return this.samples.filter((s) => s.tenantId === tenantId.value);
  }
}
