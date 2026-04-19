import type { DataRecord, QualityMetrics, ValidationReport } from './types.js';

/**
 * Computes data-quality metrics for a dataset:
 *
 * - **completeness** — fraction of non-null field values across all records
 * - **validity** — fraction of records with zero rule violations
 * - **uniqueness** — fraction of records that are unique (by JSON fingerprint)
 */
export class QualityMetricsCalculator {
  /**
   * Compute metrics given raw records and a pre-built {@link ValidationReport}.
   *
   * @param records  The original dataset.
   * @param report   Validation report produced by {@link QualityValidator.validateAll}.
   */
  compute(records: readonly DataRecord[], report: ValidationReport): QualityMetrics {
    return {
      completeness: this.completeness(records),
      validity: this.validity(records.length, report.violations.length),
      uniqueness: this.uniqueness(records),
      totalRecords: records.length,
      computedAt: new Date(),
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private completeness(records: readonly DataRecord[]): number {
    if (records.length === 0) return 1;
    let total = 0;
    let nonNull = 0;
    for (const record of records) {
      for (const value of Object.values(record)) {
        total++;
        if (value !== null && value !== undefined) nonNull++;
      }
    }
    return total === 0 ? 1 : nonNull / total;
  }

  private validity(total: number, violations: number): number {
    if (total === 0) return 1;
    return (total - violations) / total;
  }

  private uniqueness(records: readonly DataRecord[]): number {
    if (records.length === 0) return 1;
    const fingerprints = new Set(records.map((r) => JSON.stringify(r)));
    return fingerprints.size / records.length;
  }
}
