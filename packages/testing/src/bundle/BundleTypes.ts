/** Size budget for a named module or package entry-point. */
export interface SizeBudget {
  /** Human-readable name of the module or entry-point. */
  name: string;
  /** Maximum allowed raw (uncompressed) size in bytes. */
  maxBytes: number;
}

/** Budget violation produced when a module exceeds its budget. */
export interface BudgetViolation {
  module: string;
  budgetBytes: number;
  actualBytes: number;
  overageBytes: number;
}

/** Size metrics for a single compiled module. */
export interface ModuleStats {
  /** Module identifier (e.g. package name or relative path). */
  name: string;
  /** Raw size in bytes. */
  sizeBytes: number;
  /** Gzip-compressed size in bytes, if known. */
  gzippedBytes?: number;
  /**
   * Whether the module is considered tree-shakeable (has no detectable
   * top-level side-effects beyond pure declarations).
   */
  treeshakeable: boolean;
}

/** Aggregated bundle report for a package build. */
export interface BundleReport {
  generatedAt: number;
  totalSizeBytes: number;
  gzippedSizeBytes: number | undefined;
  moduleCount: number;
  budgetViolations: BudgetViolation[];
  modules: ModuleStats[];
}

/** Dependency metadata for auditing. */
export interface DependencyInfo {
  name: string;
  version: string;
  /** Estimated unpacked size in bytes. */
  sizeBytes: number;
  /** Whether this is a transitive (indirect) dependency. */
  transitive: boolean;
}

/** A single export declaration tracked by ExportAuditor. */
export interface ExportEntry {
  name: string;
  sourceFile: string;
  used: boolean;
}

/** Result of a full export audit. */
export interface ExportAuditResult {
  total: number;
  usedCount: number;
  unusedCount: number;
  unusedExports: ExportEntry[];
}
