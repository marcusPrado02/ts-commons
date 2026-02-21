import type { ModuleStats, SizeBudget, BudgetViolation, BundleReport } from './BundleTypes';

/**
 * Tracks compiled module sizes against declared budgets and generates
 * bundle reports for CI enforcement.
 *
 * @example
 * ```typescript
 * const checker = new BundleSizeChecker();
 *
 * checker.addBudget({ name: '@acme/kernel', maxBytes: 20_000 });
 * checker.register({ name: '@acme/kernel', sizeBytes: 18_500, treeshakeable: true });
 *
 * const violations = checker.checkBudgets();
 * if (violations.length > 0) {
 *   throw new Error(`Bundle budget exceeded: ${violations[0].module}`);
 * }
 * ```
 */
export class BundleSizeChecker {
  private readonly modules = new Map<string, ModuleStats>();
  private readonly budgets = new Map<string, SizeBudget>();

  /** Register a module's size metrics. Replaces any previous entry for the same name. */
  register(stats: ModuleStats): void {
    this.modules.set(stats.name, stats);
  }

  /** Declare a size budget for a named module. */
  addBudget(budget: SizeBudget): void {
    this.budgets.set(budget.name, budget);
  }

  /** Remove a previously declared budget. */
  removeBudget(name: string): void {
    this.budgets.delete(name);
  }

  /**
   * Check all registered modules against their budgets.
   * Returns violations for every module that exceeds its declared budget.
   */
  checkBudgets(): BudgetViolation[] {
    const violations: BudgetViolation[] = [];
    for (const [name, budget] of this.budgets.entries()) {
      const module = this.modules.get(name);
      if (module === undefined) continue;
      if (module.sizeBytes > budget.maxBytes) {
        violations.push({
          module: name,
          budgetBytes: budget.maxBytes,
          actualBytes: module.sizeBytes,
          overageBytes: module.sizeBytes - budget.maxBytes,
        });
      }
    }
    return violations;
  }

  /**
   * Return all modules that are NOT marked as tree-shakeable.
   * These may prevent dead-code elimination in consumer bundles.
   */
  getNonTreeshakeable(): ModuleStats[] {
    return Array.from(this.modules.values()).filter((m): boolean => !m.treeshakeable);
  }

  /** Total uncompressed size across all registered modules. */
  totalSizeBytes(): number {
    let total = 0;
    for (const m of this.modules.values()) {
      total += m.sizeBytes;
    }
    return total;
  }

  /**
   * Total gzip size across modules that provide `gzippedBytes`.
   * Returns `undefined` when no module has gzip data.
   */
  totalGzippedBytes(): number | undefined {
    let total = 0;
    let hasAny = false;
    for (const m of this.modules.values()) {
      if (m.gzippedBytes !== undefined) {
        total += m.gzippedBytes;
        hasAny = true;
      }
    }
    return hasAny ? total : undefined;
  }

  /**
   * Generate a full bundle report.
   * Runs budget checks and aggregates all module metrics.
   */
  getReport(): BundleReport {
    return {
      generatedAt: Date.now(),
      totalSizeBytes: this.totalSizeBytes(),
      gzippedSizeBytes: this.totalGzippedBytes(),
      moduleCount: this.modules.size,
      budgetViolations: this.checkBudgets(),
      modules: Array.from(this.modules.values()),
    };
  }

  /** Remove all registered modules and budgets. */
  clear(): void {
    this.modules.clear();
    this.budgets.clear();
  }

  /** Number of registered modules. */
  moduleCount(): number {
    return this.modules.size;
  }
}
