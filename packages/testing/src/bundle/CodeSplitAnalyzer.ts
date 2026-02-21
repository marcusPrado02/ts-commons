/**
 * A named chunk produced by code splitting.
 * In real bundlers each chunk maps to an output file.
 */
export interface Chunk {
  /** Unique chunk name (e.g. `"vendor"`, `"main"`, `"dashboard"`). */
  name: string;
  /** Names of modules assigned to this chunk. */
  modules: readonly string[];
  /** Whether this chunk is loaded eagerly (initial load) or via lazy import. */
  lazy: boolean;
}

/** Result of a split configuration analysis. */
export interface SplitAnalysis {
  totalChunks: number;
  lazyChunks: number;
  eagerChunks: number;
  /** Modules that appear in more than one chunk (potential duplication). */
  duplicatedModules: readonly string[];
  /** Modules that are eagerly loaded but could benefit from lazy loading. */
  lazyLoadCandidates: readonly string[];
}

/**
 * Models a code-splitting configuration and analyses it for duplication,
 * over-eager loading, and lazy-loading opportunities.
 *
 * @example
 * ```typescript
 * const analyzer = new CodeSplitAnalyzer();
 *
 * analyzer.addChunk({ name: 'main', modules: ['app', 'router'], lazy: false });
 * analyzer.addChunk({ name: 'dashboard', modules: ['charts', 'tables'], lazy: true });
 *
 * const analysis = analyzer.analyze(['charts', 'tables', 'settings']);
 * ```
 */
export class CodeSplitAnalyzer {
  private readonly chunks = new Map<string, Chunk>();

  /** Add or replace a chunk definition. */
  addChunk(chunk: Chunk): void {
    this.chunks.set(chunk.name, chunk);
  }

  /** Remove a chunk by name. */
  removeChunk(name: string): void {
    this.chunks.delete(name);
  }

  /** Return `true` if a chunk with the given name is registered. */
  hasChunk(name: string): boolean {
    return this.chunks.has(name);
  }

  /** Return all registered chunks. */
  getChunks(): Chunk[] {
    return Array.from(this.chunks.values());
  }

  /** Return only lazily-loaded chunks. */
  getLazyChunks(): Chunk[] {
    return Array.from(this.chunks.values()).filter((c): boolean => c.lazy);
  }

  /** Return only eagerly-loaded chunks. */
  getEagerChunks(): Chunk[] {
    return Array.from(this.chunks.values()).filter((c): boolean => !c.lazy);
  }

  /**
   * Find modules that appear in more than one chunk.
   * These may be bundled multiple times, increasing output size.
   */
  findDuplicatedModules(): string[] {
    const counts = new Map<string, number>();
    for (const chunk of this.chunks.values()) {
      for (const mod of chunk.modules) {
        counts.set(mod, (counts.get(mod) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .filter(([, count]): boolean => count > 1)
      .map(([mod]): string => mod);
  }

  /**
   * Analyse the split configuration.
   *
   * @param heavyModules - Modules considered "heavy" (e.g. charting libraries).
   *                       Eager chunks containing these become lazy-load candidates.
   */
  analyze(heavyModules: readonly string[] = []): SplitAnalysis {
    const duplicated = this.findDuplicatedModules();
    const heavy = new Set(heavyModules);
    const candidates: string[] = [];
    for (const chunk of this.getEagerChunks()) {
      for (const mod of chunk.modules) {
        if (heavy.has(mod) && !candidates.includes(mod)) {
          candidates.push(mod);
        }
      }
    }
    return {
      totalChunks: this.chunks.size,
      lazyChunks: this.getLazyChunks().length,
      eagerChunks: this.getEagerChunks().length,
      duplicatedModules: duplicated,
      lazyLoadCandidates: candidates,
    };
  }

  /** Remove all chunk definitions. */
  clear(): void {
    this.chunks.clear();
  }

  /** Number of registered chunks. */
  chunkCount(): number {
    return this.chunks.size;
  }
}
