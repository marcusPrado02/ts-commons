import type { QuickFix, QuickFixCategory } from './QuickFixTypes';

function fix(
  title: string,
  category: QuickFixCategory,
  description: string,
  line?: number,
  fixedCode?: string,
): QuickFix {
  return {
    title,
    category,
    description,
    line,
    fixedCode,
  };
}

function fixReadonlyFields(source: string): QuickFix[] {
  const fixes: QuickFix[] = [];
  const pattern = /^\s+(public\s+)(?!readonly\s)(\w+)\s*:/gm;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(source)) !== null) {
    const lineNum = source.slice(0, m.index).split('\n').length;
    fixes.push(
      fix(
        'Add readonly modifier',
        'add-readonly',
        'Field is not readonly — add readonly to prevent unintentional mutation.',
        lineNum,
      ),
    );
  }
  return fixes;
}

function fixNamingConventions(source: string): QuickFix[] {
  const fixes: QuickFix[] = [];
  const pattern = /class\s+([a-z]\w+)\b/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(source)) !== null) {
    const name = m[1] ?? '';
    const lineNum = source.slice(0, m.index).split('\n').length;
    const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
    fixes.push(
      fix(
        `Rename class '${name}' to '${capitalized}'`,
        'fix-naming-convention',
        'Class names should use PascalCase per TypeScript conventions.',
        lineNum,
      ),
    );
  }
  return fixes;
}

function fixMissingEqualsOnVO(source: string): QuickFix[] {
  const isVO = /(?:extends|implements)\s+\w*ValueObject/.test(source);
  if (!isVO) {
    return [];
  }
  const hasEquals = /\bequals\s*\(/.test(source);
  if (hasEquals) {
    return [];
  }
  return [
    fix(
      'Add missing equals() method',
      'add-missing-method',
      'Value Objects require structural equality — implement equals().',
    ),
  ];
}

function fixMissingToString(source: string): QuickFix[] {
  const isVO = /(?:extends|implements)\s+\w*ValueObject/.test(source);
  if (!isVO) {
    return [];
  }
  const hasToString = /\btoString\s*\(/.test(source);
  if (hasToString) {
    return [];
  }
  return [
    fix(
      'Add missing toString() method',
      'add-missing-method',
      'Value Objects should implement toString() for debugging.',
    ),
  ];
}

function fixMissingFactoryMethod(source: string): QuickFix[] {
  const hasClass = /\bclass\s+\w+/.test(source);
  if (!hasClass) {
    return [];
  }
  const hasPublicCtor = /\bpublic\s+constructor\b/.test(source);
  if (!hasPublicCtor) {
    return [];
  }
  return [
    fix(
      'Convert to private constructor + static create()',
      'add-factory-method',
      'DDD aggregates and entities should use private constructors with static factory methods.',
    ),
  ];
}

/**
 * Provides VS Code-style quick-fix actions for DDD code issues.
 */
export class QuickFixProvider {
  /** Compute all applicable quick fixes for a source file. */
  provide(source: string): QuickFix[] {
    return [
      ...fixReadonlyFields(source),
      ...fixNamingConventions(source),
      ...fixMissingEqualsOnVO(source),
      ...fixMissingToString(source),
      ...fixMissingFactoryMethod(source),
    ];
  }

  /** Returns fixes for a specific category only. */
  provideByCategory(source: string, category: QuickFixCategory): QuickFix[] {
    return this.provide(source).filter((f) => f.category === category);
  }

  /** Returns true when any quick fix is available. */
  hasFixes(source: string): boolean {
    return this.provide(source).length > 0;
  }

  /** Count fixes grouped by category. */
  countByCategory(source: string): Record<QuickFixCategory, number> {
    const fixes = this.provide(source);
    const result: Partial<Record<QuickFixCategory, number>> = {};
    for (const f of fixes) {
      const prev = result[f.category] ?? 0;
      result[f.category] = prev + 1;
    }
    return result as Record<QuickFixCategory, number>;
  }
}
