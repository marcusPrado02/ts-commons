import type { DependencyInfo } from './BundleTypes';

/** Summary of a dependency audit run. */
export interface DependencyAuditSummary {
  totalDependencies: number;
  directCount: number;
  transitiveCount: number;
  totalSizeBytes: number;
  heavyDependencies: DependencyInfo[];
}

/**
 * Audits registered dependencies for total size and flags unusually heavy
 * packages that may warrant replacement or lazy-loading.
 *
 * @example
 * ```typescript
 * const auditor = new DependencyAuditor();
 *
 * auditor.register({ name: 'lodash', version: '4.17.21', sizeBytes: 531_000, transitive: false });
 * auditor.register({ name: 'date-fns', version: '3.0.0', sizeBytes: 180_000, transitive: false });
 *
 * const heavy = auditor.findHeavy(200_000);
 * // → [{ name: 'lodash', sizeBytes: 531_000, ... }]
 * ```
 */
export class DependencyAuditor {
  private readonly deps = new Map<string, DependencyInfo>();

  /** Register a dependency. Replaces any previous entry with the same name. */
  register(dep: DependencyInfo): void {
    this.deps.set(dep.name, dep);
  }

  /** Register multiple dependencies at once. */
  registerAll(deps: readonly DependencyInfo[]): void {
    for (const dep of deps) {
      this.register(dep);
    }
  }

  /**
   * Return all dependencies whose size exceeds `thresholdBytes`.
   * Sorted largest-first.
   */
  findHeavy(thresholdBytes: number): DependencyInfo[] {
    return Array.from(this.deps.values())
      .filter((d): boolean => d.sizeBytes > thresholdBytes)
      .sort((a, b): number => b.sizeBytes - a.sizeBytes);
  }

  /** Return all registered dependencies. */
  getAll(): DependencyInfo[] {
    return Array.from(this.deps.values());
  }

  /** Return only direct (non-transitive) dependencies. */
  getDirect(): DependencyInfo[] {
    return Array.from(this.deps.values()).filter((d): boolean => !d.transitive);
  }

  /** Return only transitive (indirect) dependencies. */
  getTransitive(): DependencyInfo[] {
    return Array.from(this.deps.values()).filter((d): boolean => d.transitive);
  }

  /** Total size in bytes across all registered dependencies. */
  totalSizeBytes(): number {
    let sum = 0;
    for (const d of this.deps.values()) {
      sum += d.sizeBytes;
    }
    return sum;
  }

  /** Look up a dependency by name. */
  find(name: string): DependencyInfo | undefined {
    return this.deps.get(name);
  }

  /**
   * Returns a full summary of the current dep registry.
   *
   * @param heavyThresholdBytes - Size threshold for "heavy" detection (default 100 KB).
   */
  summarize(heavyThresholdBytes: number = 100_000): DependencyAuditSummary {
    return {
      totalDependencies: this.deps.size,
      directCount: this.getDirect().length,
      transitiveCount: this.getTransitive().length,
      totalSizeBytes: this.totalSizeBytes(),
      heavyDependencies: this.findHeavy(heavyThresholdBytes),
    };
  }

  /** Remove a dependency from the registry. */
  remove(name: string): void {
    this.deps.delete(name);
  }

  /** Clear all registered dependencies. */
  clear(): void {
    this.deps.clear();
  }

  /** Number of registered dependencies. */
  dependencyCount(): number {
    return this.deps.size;
  }
}
