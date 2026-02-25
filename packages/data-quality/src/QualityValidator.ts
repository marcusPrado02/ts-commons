import type { DataRecord, QualityRule, RuleViolation, ValidationReport } from './types.js';

/**
 * Validates a dataset against a configurable set of {@link QualityRule}s.
 *
 * @example
 * ```ts
 * const validator = new QualityValidator()
 *   .addRule({ name: 'required-id', validate: r => r['id'] == null ? 'id required' : undefined });
 *
 * const report = validator.validateAll(records);
 * ```
 */
export class QualityValidator {
  private readonly rules: QualityRule[] = [];

  /** Register a rule — returns `this` for fluent chaining. */
  addRule(rule: QualityRule): this {
    this.rules.push(rule);
    return this;
  }

  /** Number of currently registered rules. */
  ruleCount(): number {
    return this.rules.length;
  }

  /**
   * Validate a single record.
   * @returns Array of error messages (empty when all rules pass).
   */
  validate(record: DataRecord): string[] {
    const messages: string[] = [];
    for (const rule of this.rules) {
      const msg = rule.validate(record);
      if (msg !== undefined) {
        messages.push(msg);
      }
    }
    return messages;
  }

  /** Collect violated rule names for a single record. */
  private violatedRuleNames(record: DataRecord): string[] {
    return this.rules.filter((r) => r.validate(record) !== undefined).map((r) => r.name);
  }

  /** Validate all records and aggregate results into a {@link ValidationReport}. */
  validateAll(records: readonly DataRecord[]): ValidationReport {
    const violations: RuleViolation[] = [];

    for (const record of records) {
      const messages = this.validate(record);
      if (messages.length > 0) {
        violations.push({
          record,
          ruleNames: this.violatedRuleNames(record),
          messages,
        });
      }
    }

    return {
      valid: violations.length === 0,
      totalRecords: records.length,
      validRecords: records.length - violations.length,
      violations,
    };
  }
}
