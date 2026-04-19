/**
 * A generic data record — all fields are unknown at compile time.
 */
export type DataRecord = Record<string, unknown>;

// ─── Validation rules ─────────────────────────────────────────────────────────

/** A single named validation rule applied to a {@link DataRecord}. */
export interface QualityRule {
  /** Unique rule identifier used in reports. */
  readonly name: string;
  /**
   * Evaluate the record.
   * @returns An error message string when the rule fails, or `undefined` when it passes.
   */
  validate(record: DataRecord): string | undefined;
}

/** Outcome of validating one record against all registered rules. */
export interface RuleViolation {
  readonly record: DataRecord;
  readonly ruleNames: string[];
  readonly messages: string[];
}

/** Aggregated validation result for a dataset. */
export interface ValidationReport {
  readonly valid: boolean;
  readonly totalRecords: number;
  readonly validRecords: number;
  readonly violations: RuleViolation[];
}

// ─── Data profiling ───────────────────────────────────────────────────────────

/** Per-field statistics collected during profiling. */
export interface FieldProfile {
  readonly field: string;
  readonly count: number;
  readonly nullCount: number;
  readonly uniqueCount: number;
  readonly min: unknown;
  readonly max: unknown;
  readonly mean: number | undefined;
}

/** Full dataset profile produced by {@link DataProfiler}. */
export interface DataProfile {
  readonly totalRecords: number;
  readonly fields: FieldProfile[];
  readonly profiledAt: Date;
}

// ─── Anomaly detection ────────────────────────────────────────────────────────

/** Severity level of an anomaly. */
export type AnomalySeverity = 'low' | 'medium' | 'high';

/** A single detected anomaly. */
export interface Anomaly {
  readonly field: string;
  readonly record: DataRecord;
  readonly message: string;
  readonly severity: AnomalySeverity;
}

/** Result returned by an {@link AnomalyDetector} run. */
export interface AnomalyReport {
  readonly anomalies: Anomaly[];
  readonly totalChecked: number;
}

/** Contract for pluggable anomaly detection strategies. */
export interface AnomalyDetector {
  detect(records: readonly DataRecord[]): AnomalyReport;
}

// ─── Quality metrics ──────────────────────────────────────────────────────────

/** Aggregated quality score for a dataset. */
export interface QualityMetrics {
  readonly completeness: number; // 0–1 fraction of non-null values
  readonly validity: number; // 0–1 fraction passing all rules
  readonly uniqueness: number; // 0–1 fraction of unique records
  readonly totalRecords: number;
  readonly computedAt: Date;
}

// ─── Quality reports ──────────────────────────────────────────────────────────

/** Full quality report combining all sub-analyses. */
export interface QualityReport {
  readonly metrics: QualityMetrics;
  readonly validation: ValidationReport;
  readonly profile: DataProfile;
  readonly anomalies: AnomalyReport;
  readonly generatedAt: Date;
}
