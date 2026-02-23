import type { RefactoringKind, RefactoringReport, RefactoringSuggestion } from './RefactoringTypes';

function suggestion(
  title: string,
  rationale: string,
  kind: RefactoringKind,
  line?: number,
  replacement?: string,
): RefactoringSuggestion {
  return {
    title,
    rationale,
    kind,
    line,
    replacement,
  };
}

function checkPrimitiveString(source: string): RefactoringSuggestion[] {
  const suggestions: RefactoringSuggestion[] = [];
  const pattern = /\b(\w+(?:Email|Phone|Url|Id|Name|Code|Cpf|Cnpj))\s*:\s*string\b/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(source)) !== null) {
    const fieldName = m[1] ?? 'field';
    const lineNum = source.slice(0, m.index).split('\n').length;
    suggestions.push(
      suggestion(
        `Extract Value Object for '${fieldName}'`,
        `Primitive string for '${fieldName}' is likely a domain concept — wrap it in a Value Object.`,
        'replace-primitive-obsession',
        lineNum,
      ),
    );
  }
  return suggestions;
}

function checkMutableArrayFields(source: string): RefactoringSuggestion[] {
  const suggestions: RefactoringSuggestion[] = [];
  const pattern = /\b(\w+)\s*:\s*(?!readonly\s)(\w+)\[\]/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(source)) !== null) {
    const fieldName = m[1] ?? 'field';
    const lineNum = source.slice(0, m.index).split('\n').length;
    suggestions.push(
      suggestion(
        `Encapsulate collection '${fieldName}'`,
        `Public mutable array '${fieldName}' breaks encapsulation — expose add/remove methods and use readonly.`,
        'encapsulate-collection',
        lineNum,
      ),
    );
  }
  return suggestions;
}

function checkPublicNonReadonly(source: string): RefactoringSuggestion[] {
  const suggestions: RefactoringSuggestion[] = [];
  const pattern = /^\s+public\s+(?!readonly\s)(?!static\s)(\w+)\s*[=:]/gm;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(source)) !== null) {
    const fieldName = m[1] ?? 'field';
    const lineNum = source.slice(0, m.index).split('\n').length;
    suggestions.push(
      suggestion(
        `Add readonly to '${fieldName}'`,
        `Public non-readonly field '${fieldName}' may violate immutability — consider adding readonly.`,
        'add-readonly',
        lineNum,
      ),
    );
  }
  return suggestions;
}

function checkFactoryOpportunity(source: string): RefactoringSuggestion[] {
  const isComplex = (source.match(/new\s+\w+\(/g) ?? []).length >= 3;
  if (!isComplex) {
    return [];
  }
  return [
    suggestion(
      'Introduce Factory',
      'Multiple object instantiations detected — consider introducing a Factory to centralise creation logic.',
      'introduce-factory',
    ),
  ];
}

function isHighPriority(s: RefactoringSuggestion): boolean {
  return (
    s.kind === 'enforce-invariant' ||
    s.kind === 'replace-primitive-obsession' ||
    s.kind === 'encapsulate-collection'
  );
}

/**
 * Analyses TypeScript source for DDD refactoring opportunities.
 */
export class RefactoringTool {
  /** Analyse a source file and return ranked refactoring suggestions. */
  analyse(source: string): RefactoringReport {
    const suggestions: RefactoringSuggestion[] = [
      ...checkPrimitiveString(source),
      ...checkMutableArrayFields(source),
      ...checkPublicNonReadonly(source),
      ...checkFactoryOpportunity(source),
    ];
    return {
      suggestions,
      count: suggestions.length,
      hasHighPriority: suggestions.some((s) => isHighPriority(s)),
    };
  }

  /** Returns only suggestions of a specific kind. */
  filterByKind(source: string, kind: RefactoringKind): readonly RefactoringSuggestion[] {
    return this.analyse(source).suggestions.filter((s) => s.kind === kind);
  }

  /** Returns whether the source has any refactoring suggestions. */
  hasOpportunities(source: string): boolean {
    return this.analyse(source).count > 0;
  }
}
