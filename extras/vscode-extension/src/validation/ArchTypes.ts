/** Severity level of an architecture violation. */
export type ViolationSeverity = 'error' | 'warning' | 'info';

/** A single architecture constraint violation. */
export interface ArchViolation {
  readonly rule: string;
  readonly message: string;
  readonly severity: ViolationSeverity;
  /** 1-based line number where the violation was found, if applicable. */
  readonly line: number | undefined;
}

/** Result of validating a single file against architecture rules. */
export interface ValidationResult {
  readonly file: string;
  readonly violations: readonly ArchViolation[];
  readonly passed: boolean;
  readonly errorCount: number;
  readonly warningCount: number;
}

/** Aggregated result across multiple files / a project. */
export interface ProjectValidationResult {
  readonly results: readonly ValidationResult[];
  readonly totalErrors: number;
  readonly totalWarnings: number;
  readonly passed: boolean;
  readonly fileCount: number;
}

/** Describes what layer a file belongs to based on its path. */
export type ArchLayer = 'domain' | 'application' | 'infrastructure' | 'presentation' | 'unknown';
