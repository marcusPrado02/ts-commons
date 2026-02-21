import type { ExportEntry, ExportAuditResult } from './BundleTypes';

/**
 * Tracks package exports and whether they are actually imported by consumers.
 *
 * Useful for identifying dead exports that increase bundle size without
 * providing value to end users.
 *
 * @example
 * ```typescript
 * const auditor = new ExportAuditor();
 *
 * // Register all exports from the public API:
 * auditor.registerExport('Result', 'src/Result.ts');
 * auditor.registerExport('Option', 'src/Option.ts');
 * auditor.registerExport('LegacyHelper', 'src/legacy.ts');
 *
 * // Mark which exports are actually consumed:
 * auditor.markUsed('Result');
 * auditor.markUsed('Option');
 *
 * const report = auditor.analyze();
 * // report.unusedExports → [{ name: 'LegacyHelper', ... }]
 * ```
 */
export class ExportAuditor {
  private readonly exports = new Map<string, ExportEntry>();

  /** Register a named export from a given source file. */
  registerExport(name: string, sourceFile: string): void {
    this.exports.set(name, { name, sourceFile, used: false });
  }

  /** Register multiple exports from the same source file at once. */
  registerExports(names: readonly string[], sourceFile: string): void {
    for (const name of names) {
      this.registerExport(name, sourceFile);
    }
  }

  /** Mark an export as used by at least one consumer. */
  markUsed(name: string): void {
    const entry = this.exports.get(name);
    if (entry !== undefined) {
      this.exports.set(name, { ...entry, used: true });
    }
  }

  /** Mark multiple exports as used. */
  markUsedAll(names: readonly string[]): void {
    for (const name of names) {
      this.markUsed(name);
    }
  }

  /** Return all exports that have not been marked as used. */
  getUnusedExports(): ExportEntry[] {
    return Array.from(this.exports.values()).filter((e): boolean => !e.used);
  }

  /** Return all exports that are marked as used. */
  getUsedExports(): ExportEntry[] {
    return Array.from(this.exports.values()).filter((e): boolean => e.used);
  }

  /**
   * Return all exports from a specific source file (used or unused).
   * Useful for auditing a single module's public surface.
   */
  getExportsByFile(sourceFile: string): ExportEntry[] {
    return Array.from(this.exports.values()).filter((e): boolean => e.sourceFile === sourceFile);
  }

  /** Full audit result with counts and the unused-export list. */
  analyze(): ExportAuditResult {
    const all = Array.from(this.exports.values());
    const unused = all.filter((e): boolean => !e.used);
    return {
      total: all.length,
      usedCount: all.length - unused.length,
      unusedCount: unused.length,
      unusedExports: unused,
    };
  }

  /**
   * Fraction of exports that are used (0–1).
   * Returns `1` when no exports are registered.
   */
  usageRatio(): number {
    const total = this.exports.size;
    if (total === 0) return 1;
    const used = Array.from(this.exports.values()).filter((e): boolean => e.used).length;
    return used / total;
  }

  /** Remove all registered exports. */
  clear(): void {
    this.exports.clear();
  }

  /** Total number of registered exports. */
  exportCount(): number {
    return this.exports.size;
  }
}
