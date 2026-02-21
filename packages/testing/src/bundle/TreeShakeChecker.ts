/** Categorized tree-shake analysis result. */
export interface TreeShakeAnalysis {
  /** Symbols with no known side effects — safe to tree-shake. */
  treeshakeable: readonly string[];
  /** Symbols with detectable side effects — will not be eliminated. */
  impure: readonly string[];
  /** Fraction of symbols that are tree-shakeable (0–1). */
  purityRatio: number;
}

/**
 * Tracks which exported symbols have side effects and produces an analysis
 * report for build-time tree-shaking validation.
 *
 * Symbols not explicitly annotated are assumed to have side effects
 * (conservative default to avoid silent misclassifications).
 *
 * @example
 * ```typescript
 * const checker = new TreeShakeChecker();
 *
 * checker.markPure(['Result', 'Option', 'Duration']);
 * checker.markImpure(['bootstrapApp']); // registers global event listeners
 *
 * const analysis = checker.analyze();
 * // analysis.purityRatio → 0.75 (3 pure out of 4 total)
 * ```
 */
export class TreeShakeChecker {
  /** `true` = pure (tree-shakeable), `false` = has side-effects. */
  private readonly symbols = new Map<string, boolean>();

  /** Mark a single symbol as pure (no side effects). */
  markPure(name: string): void {
    this.symbols.set(name, true);
  }

  /** Mark multiple symbols as pure at once. */
  markPureAll(names: readonly string[]): void {
    for (const name of names) {
      this.markPure(name);
    }
  }

  /** Mark a single symbol as having side effects. */
  markImpure(name: string): void {
    this.symbols.set(name, false);
  }

  /** Mark multiple symbols as impure at once. */
  markImpureAll(names: readonly string[]): void {
    for (const name of names) {
      this.markImpure(name);
    }
  }

  /** Return `true` if the symbol is registered and pure. */
  isPure(name: string): boolean {
    return this.symbols.get(name) === true;
  }

  /** Return `true` if the symbol is registered and impure (has side effects). */
  isImpure(name: string): boolean {
    return this.symbols.get(name) === false;
  }

  /** Return `true` if the symbol has been registered at all. */
  isRegistered(name: string): boolean {
    return this.symbols.has(name);
  }

  /**
   * Return a full tree-shake analysis.
   * `purityRatio` is `1` when no symbols are registered.
   */
  analyze(): TreeShakeAnalysis {
    const treeshakeable: string[] = [];
    const impure: string[] = [];
    for (const [name, pure] of this.symbols.entries()) {
      if (pure) {
        treeshakeable.push(name);
      } else {
        impure.push(name);
      }
    }
    const total = this.symbols.size;
    const purityRatio = total === 0 ? 1 : treeshakeable.length / total;
    return { treeshakeable, impure, purityRatio };
  }

  /** Clear all registered symbols. */
  clear(): void {
    this.symbols.clear();
  }

  /** Number of registered symbols. */
  symbolCount(): number {
    return this.symbols.size;
  }
}
