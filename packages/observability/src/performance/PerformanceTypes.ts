/**
 * Immutable value object representing a duration of time.
 */
export class Duration {
  private constructor(private readonly ms: number) {}

  static fromMilliseconds(ms: number): Duration {
    return new Duration(ms);
  }

  static fromSeconds(seconds: number): Duration {
    return new Duration(seconds * 1000);
  }

  toMilliseconds(): number {
    return this.ms;
  }

  toSeconds(): number {
    return this.ms / 1000;
  }

  isGreaterThan(other: Duration): boolean {
    return this.ms > other.ms;
  }
}

/**
 * A single timing observation for a named operation.
 */
export interface TimingSample {
  readonly operation: string;
  readonly durationMs: number;
  readonly timestamp: Date;
  readonly labels?: Readonly<Record<string, string>>;
}

/**
 * Record of a slow query detection event.
 */
export interface SlowQueryRecord {
  readonly query: string;
  readonly durationMs: number;
  readonly timestamp: Date;
}

/**
 * Point-in-time snapshot of Node.js process memory usage.
 */
export interface MemorySnapshot {
  readonly heapUsedBytes: number;
  readonly heapTotalBytes: number;
  readonly externalBytes: number;
  readonly rssBytes: number;
  readonly timestamp: Date;
}

/**
 * A `PerformanceBudget` defines an acceptable latency threshold for a named
 * operation. When the budget is exceeded, the violation is recorded.
 */
export interface PerformanceBudget {
  readonly name: string;
  /** Threshold in milliseconds. */
  readonly thresholdMs: number;
}

/**
 * Recorded when a timing observation exceeds the associated budget.
 */
export interface BudgetViolation {
  readonly operationName: string;
  readonly thresholdMs: number;
  readonly actualMs: number;
  readonly timestamp: Date;
}

/**
 * Aggregated performance report for a monitoring window.
 */
export interface PerformanceReport {
  readonly generatedAt: Date;
  readonly samples: ReadonlyArray<TimingSample>;
  readonly slowQueries: ReadonlyArray<SlowQueryRecord>;
  readonly memorySnapshots: ReadonlyArray<MemorySnapshot>;
  readonly budgetViolations: ReadonlyArray<BudgetViolation>;
}
