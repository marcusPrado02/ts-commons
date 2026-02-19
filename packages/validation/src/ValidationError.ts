/**
 * A single validation issue for a specific field.
 */
export interface ValidationIssue {
  /** The field path that failed (e.g. "email", "address.city"). */
  readonly field: string;
  /** Human-readable error message. */
  readonly message: string;
  /** Machine-readable error code (e.g. "invalid_string", "too_small"). */
  readonly code?: string;
  /** The invalid value that caused the failure. */
  readonly value?: unknown;
}

/**
 * Thrown/returned when one or more validation rules fail.
 *
 * @example
 * ```ts
 * const err = ValidationError.fromMessage('email', 'Invalid email address');
 * err.hasField('email'); // true
 * ```
 */
export class ValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[], message?: string) {
    super(message ?? `Validation failed with ${issues.length} issue(s)`);
    this.name = 'ValidationError';
    this.issues = issues;
  }

  /** Creates a ValidationError from a list of issues. */
  static fromIssues(issues: ValidationIssue[]): ValidationError {
    return new ValidationError(issues);
  }

  /** Creates a ValidationError with a single issue for a named field. */
  static fromMessage(field: string, message: string, code?: string): ValidationError {
    const issue: Record<string, unknown> = { field, message };
    if (code !== undefined) issue['code'] = code;
    return new ValidationError([issue as unknown as ValidationIssue]);
  }

  /** Returns true if any issue targets the given field. */
  hasField(field: string): boolean {
    return this.issues.some((i) => i.field === field);
  }

  /** Returns all issues for the given field. */
  getFieldIssues(field: string): ValidationIssue[] {
    return this.issues.filter((i) => i.field === field);
  }

  /** Returns the first issue message for the given field, or undefined. */
  firstMessage(field: string): string | undefined {
    return this.issues.find((i) => i.field === field)?.message;
  }
}
