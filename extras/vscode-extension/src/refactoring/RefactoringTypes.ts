/** A single refactoring suggestion for a DDD code smell. */
export interface RefactoringSuggestion {
  /** Short title shown in the editor context menu. */
  readonly title: string;
  /** Explanation of why this refactoring is recommended. */
  readonly rationale: string;
  /** Category of the refactoring. */
  readonly kind: RefactoringKind;
  /** 1-based line number where the issue was detected. */
  readonly line: number | undefined;
  /** Suggested replacement code snippet, if any. */
  readonly replacement: string | undefined;
}

/** Categories of DDD refactoring opportunities. */
export type RefactoringKind =
  | 'extract-value-object'
  | 'introduce-factory'
  | 'encapsulate-collection'
  | 'extract-domain-service'
  | 'replace-primitive-obsession'
  | 'add-readonly'
  | 'enforce-invariant';

/** Result of analysing a source file for refactoring opportunities. */
export interface RefactoringReport {
  readonly suggestions: readonly RefactoringSuggestion[];
  readonly count: number;
  readonly hasHighPriority: boolean;
}
