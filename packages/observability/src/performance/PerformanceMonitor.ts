import type {
  BudgetViolation,
  MemorySnapshot,
  PerformanceBudget,
  PerformanceReport,
  SlowQueryRecord,
  TimingSample,
} from './PerformanceTypes';

export interface PerformanceMonitorOptions {
  readonly slowQueryThresholdMs?: number;
  readonly maxSamples?: number;
}

const DEFAULT_SLOW_THRESHOLD = 1000;
const DEFAULT_MAX_SAMPLES = 1000;

function trimArray<T>(arr: T[], max: number): void {
  if (arr.length > max) arr.splice(0, arr.length - max);
}

function buildViolation(name: string, thresholdMs: number, actualMs: number): BudgetViolation {
  return { operationName: name, thresholdMs, actualMs, timestamp: new Date() };
}

/**
 * Central APM component — tracks operation timing, slow queries, memory
 * snapshots, and performance budget violations.
 */
export class PerformanceMonitor {
  private readonly slowThresholdMs: number;
  private readonly maxSamples: number;
  private readonly samples: TimingSample[] = [];
  private readonly slowQueries: SlowQueryRecord[] = [];
  private readonly memorySnapshots: MemorySnapshot[] = [];
  private readonly violations: BudgetViolation[] = [];
  private readonly budgets = new Map<string, PerformanceBudget>();

  constructor(options?: PerformanceMonitorOptions) {
    this.slowThresholdMs = options?.slowQueryThresholdMs ?? DEFAULT_SLOW_THRESHOLD;
    this.maxSamples = options?.maxSamples ?? DEFAULT_MAX_SAMPLES;
  }

  /**
   * Times an async operation, records the result, and returns the value.
   * Any budget registered for `operation` is checked after the call.
   */
  async time<T>(
    operation: string,
    fn: () => Promise<T>,
    labels?: Readonly<Record<string, string>>,
  ): Promise<T> {
    const start = Date.now();
    const result = await fn();
    const durationMs = Date.now() - start;
    this.record(operation, durationMs, labels);
    return result;
  }

  private record(
    operation: string,
    durationMs: number,
    labels?: Readonly<Record<string, string>>,
  ): void {
    const sample: TimingSample = {
      operation,
      durationMs,
      timestamp: new Date(),
      ...(labels === undefined ? {} : { labels }),
    };
    this.samples.push(sample);
    trimArray(this.samples, this.maxSamples);
    this.checkBudget(operation, durationMs);
  }

  /**
   * Manually records a slow query observation.
   * Auto-detection against `slowQueryThresholdMs` is also triggered here.
   */
  recordSlowQuery(query: string, durationMs: number): void {
    if (durationMs <= this.slowThresholdMs) return;
    this.slowQueries.push({ query, durationMs, timestamp: new Date() });
  }

  /**
   * Captures the current Node.js process memory usage and stores it.
   * Returns the snapshot (useful for inline assertions in tests).
   */
  snapshotMemory(): MemorySnapshot {
    const mem = process.memoryUsage();
    const snap: MemorySnapshot = {
      heapUsedBytes: mem.heapUsed,
      heapTotalBytes: mem.heapTotal,
      externalBytes: mem.external,
      rssBytes: mem.rss,
      timestamp: new Date(),
    };
    this.memorySnapshots.push(snap);
    return snap;
  }

  /** Register a performance budget for an operation name. */
  addBudget(budget: PerformanceBudget): void {
    this.budgets.set(budget.name, budget);
  }

  /** Remove a registered budget. Returns `true` if it existed. */
  removeBudget(name: string): boolean {
    return this.budgets.delete(name);
  }

  private checkBudget(operation: string, durationMs: number): void {
    const budget = this.budgets.get(operation);
    if (budget === undefined) return;
    if (durationMs <= budget.thresholdMs) return;
    this.violations.push(buildViolation(operation, budget.thresholdMs, durationMs));
  }

  /** Returns a snapshot of all collected performance data. */
  getReport(): PerformanceReport {
    return {
      generatedAt: new Date(),
      samples: [...this.samples],
      slowQueries: [...this.slowQueries],
      memorySnapshots: [...this.memorySnapshots],
      budgetViolations: [...this.violations],
    };
  }

  /** Clears all collected data (budgets are kept). */
  clear(): void {
    this.samples.splice(0);
    this.slowQueries.splice(0);
    this.memorySnapshots.splice(0);
    this.violations.splice(0);
  }
}
