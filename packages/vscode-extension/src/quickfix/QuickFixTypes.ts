/** A quick fix action that can be applied to source code. */
export interface QuickFix {
  /** Short action label shown in the editor light-bulb menu. */
  readonly title: string;
  /** Category that groups related fixes. */
  readonly category: QuickFixCategory;
  /** Detailed explanation of what the fix does. */
  readonly description: string;
  /** 1-based line number where the fix should be applied. */
  readonly line: number | undefined;
  /** The transformed source code after applying the fix, if computable. */
  readonly fixedCode: string | undefined;
}

/** High-level categories for quick-fix actions. */
export type QuickFixCategory =
  | 'add-import'
  | 'add-readonly'
  | 'extract-interface'
  | 'convert-to-vo'
  | 'add-factory-method'
  | 'fix-naming-convention'
  | 'add-missing-method';
