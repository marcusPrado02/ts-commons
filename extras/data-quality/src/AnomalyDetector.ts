import type {
  DataRecord,
  Anomaly,
  AnomalyReport,
  AnomalyDetector,
  AnomalySeverity,
} from './types.js';

/**
 * Detects numeric outliers using the Z-score method.
 *
 * A value is flagged when `|z| > threshold` (default 3.0).
 */
export class ZScoreAnomalyDetector implements AnomalyDetector {
  constructor(
    private readonly field: string,
    private readonly threshold = 3.0,
    private readonly severity: AnomalySeverity = 'medium',
  ) {}

  detect(records: readonly DataRecord[]): AnomalyReport {
    const values = this.extractNumerics(records);
    if (values.length < 2) {
      return { anomalies: [], totalChecked: records.length };
    }

    const mean = this.mean(values);
    const std = this.stdDev(values, mean);
    if (std === 0) {
      return { anomalies: [], totalChecked: records.length };
    }

    const anomalies: Anomaly[] = [];
    for (const record of records) {
      const raw = record[this.field];
      if (typeof raw !== 'number') continue;
      const z = Math.abs((raw - mean) / std);
      if (z > this.threshold) {
        anomalies.push({
          field: this.field,
          record,
          message: `Z-score ${z.toFixed(2)} exceeds threshold ${this.threshold} (value=${raw})`,
          severity: this.severity,
        });
      }
    }

    return { anomalies, totalChecked: records.length };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private extractNumerics(records: readonly DataRecord[]): number[] {
    return records.map((r) => r[this.field]).filter((v): v is number => typeof v === 'number');
  }

  private mean(values: number[]): number {
    return values.reduce((s, v) => s + v, 0) / values.length;
  }

  private stdDev(values: number[], mean: number): number {
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }
}

/**
 * Detects null/missing values in a required field.
 */
export class NullAnomalyDetector implements AnomalyDetector {
  constructor(
    private readonly field: string,
    private readonly severity: AnomalySeverity = 'high',
  ) {}

  detect(records: readonly DataRecord[]): AnomalyReport {
    const anomalies: Anomaly[] = [];
    for (const record of records) {
      const value = record[this.field];
      if (value === null || value === undefined) {
        anomalies.push({
          field: this.field,
          record,
          message: `Required field "${this.field}" is null or missing`,
          severity: this.severity,
        });
      }
    }
    return { anomalies, totalChecked: records.length };
  }
}

/**
 * Composite detector that aggregates results from multiple {@link AnomalyDetector}s.
 */
export class CompositeAnomalyDetector implements AnomalyDetector {
  private readonly detectors: AnomalyDetector[] = [];

  /** Add a detector — returns `this` for fluent chaining. */
  addDetector(detector: AnomalyDetector): this {
    this.detectors.push(detector);
    return this;
  }

  /** Number of registered detectors. */
  detectorCount(): number {
    return this.detectors.length;
  }

  detect(records: readonly DataRecord[]): AnomalyReport {
    const anomalies: Anomaly[] = [];
    for (const detector of this.detectors) {
      const report = detector.detect(records);
      anomalies.push(...report.anomalies);
    }
    return { anomalies, totalChecked: records.length };
  }
}
