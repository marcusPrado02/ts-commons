import type { DataRecord, QualityReport, AnomalyDetector } from './types.js';
import { QualityValidator } from './QualityValidator.js';
import { DataProfiler } from './DataProfiler.js';
import { QualityMetricsCalculator } from './QualityMetricsCalculator.js';
import { CompositeAnomalyDetector } from './AnomalyDetector.js';

/**
 * Orchestrates the full data-quality pipeline:
 *
 * 1. **Validation** — runs all registered {@link QualityValidator} rules
 * 2. **Profiling** — computes per-field statistics via {@link DataProfiler}
 * 3. **Anomaly detection** — runs all registered {@link AnomalyDetector}s
 * 4. **Metrics** — derives completeness, validity, and uniqueness scores
 *
 * @example
 * ```ts
 * const engine = new QualityReportEngine()
 *   .addRule({ name: 'has-id', validate: r => r['id'] == null ? 'id required' : undefined })
 *   .addDetector(new NullAnomalyDetector('email'));
 *
 * const report = engine.run(records);
 * ```
 */
export class QualityReportEngine {
  private readonly validator = new QualityValidator();
  private readonly profiler = new DataProfiler();
  private readonly metricsCalc = new QualityMetricsCalculator();
  private readonly composite = new CompositeAnomalyDetector();

  /** Register a validation rule — returns `this` for fluent chaining. */
  addRule(rule: Parameters<QualityValidator['addRule']>[0]): this {
    this.validator.addRule(rule);
    return this;
  }

  /** Register an anomaly detector — returns `this` for fluent chaining. */
  addDetector(detector: AnomalyDetector): this {
    this.composite.addDetector(detector);
    return this;
  }

  /**
   * Run the full quality analysis on the given records.
   * @returns A {@link QualityReport} with all sub-results.
   */
  run(records: readonly DataRecord[]): QualityReport {
    const validation = this.validator.validateAll(records);
    const profile = this.profiler.profile(records);
    const anomalies = this.composite.detect(records);
    const metrics = this.metricsCalc.compute(records, validation);

    return {
      metrics,
      validation,
      profile,
      anomalies,
      generatedAt: new Date(),
    };
  }
}
