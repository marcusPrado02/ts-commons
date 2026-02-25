import type { ValidationRule, ValidationReport, ValidationError, DataRecord } from './types.js';

/**
 * Validates {@link DataRecord}s against a set of registered
 * {@link ValidationRule}s.
 */
export class DataValidator {
  private readonly rules: ValidationRule[] = [];

  /**
   * Add a validation rule.
   * Returns `this` for a fluent API.
   */
  addRule(rule: ValidationRule): this {
    this.rules.push(rule);
    return this;
  }

  /**
   * Validate a single record.
   * @returns An array of error messages (empty when valid).
   */
  validate(record: DataRecord): string[] {
    const errors: string[] = [];
    for (const rule of this.rules) {
      const msg = rule.validate(record);
      if (msg !== undefined) {
        errors.push(msg);
      }
    }
    return errors;
  }

  /**
   * Validate every record in `records`.
   * @returns A {@link ValidationReport} aggregating all failures.
   */
  validateAll(records: readonly DataRecord[]): ValidationReport {
    const errors: ValidationError[] = [];
    for (const record of records) {
      const messages: string[] = [];
      const ruleNames: string[] = [];
      for (const rule of this.rules) {
        const msg = rule.validate(record);
        if (msg !== undefined) {
          messages.push(msg);
          ruleNames.push(rule.name);
        }
      }
      if (messages.length > 0) {
        errors.push({ record, ruleNames, messages });
      }
    }
    return { valid: errors.length === 0, errors };
  }

  /** Number of registered rules. */
  ruleCount(): number {
    return this.rules.length;
  }
}
