import type {
  ArchLayer,
  ArchViolation,
  ProjectValidationResult,
  ValidationResult,
  ViolationSeverity,
} from './ArchTypes';

const DOMAIN_PATHS = ['/domain/', '/entities/', '/value-objects/'];
const APP_PATHS = ['/application/', '/use-cases/', '/usecases/'];
const INFRA_PATHS = ['/infrastructure/', '/infra/', '/adapters/'];
const PRES_PATHS = ['/presentation/', '/controllers/', '/http/'];

function matchesAny(p: string, paths: readonly string[]): boolean {
  return paths.some((seg) => p.includes(seg));
}

function detectLayer(filePath: string): ArchLayer {
  const p = filePath.toLowerCase();
  if (matchesAny(p, DOMAIN_PATHS)) return 'domain';
  if (matchesAny(p, APP_PATHS)) return 'application';
  if (matchesAny(p, INFRA_PATHS)) return 'infrastructure';
  if (matchesAny(p, PRES_PATHS)) return 'presentation';
  return 'unknown';
}

function makeViolation(
  rule: string,
  message: string,
  severity: ViolationSeverity,
  line?: number,
): ArchViolation {
  return { rule, message, severity, line };
}

function getImportPaths(source: string): Array<{ path: string; line: number }> {
  const pattern = /^import\s+.*?from\s+['"]([^'"]+)['"]/gm;
  const results: Array<{ path: string; line: number }> = [];
  let match: RegExpExecArray | null;
  const lines = source.split('\n');
  while ((match = pattern.exec(source)) !== null) {
    const upTo = source.slice(0, match.index);
    const lineNum = upTo.split('\n').length;
    const lineText = lines[lineNum - 1] ?? '';
    if (!lineText.trimStart().startsWith('//')) {
      results.push({ path: match[1] ?? '', line: lineNum });
    }
  }
  return results;
}

function isInfraPath(importPath: string): boolean {
  return (
    importPath.includes('/infra') ||
    importPath.includes('/infrastructure') ||
    importPath.includes('/adapters') ||
    importPath.includes('/persistence') ||
    importPath.includes('/database')
  );
}

function checkDomainImports(imports: Array<{ path: string; line: number }>): ArchViolation[] {
  return imports
    .filter((i) => isInfraPath(i.path))
    .map((i) =>
      makeViolation(
        'DOMAIN_NO_INFRA',
        `Domain layer must not import from infrastructure: '${i.path}'`,
        'error',
        i.line,
      ),
    );
}

function checkMissingPrivateConstructor(source: string): ArchViolation[] {
  const entityClass = /class\s+\w+\s+(?:extends|implements)\s+\w*Entity/.test(source);
  if (!entityClass) {
    return [];
  }
  const hasPrivate = /private\s+constructor/.test(source);
  if (hasPrivate) {
    return [];
  }
  return [
    makeViolation(
      'ENTITY_PRIVATE_CTOR',
      'Entity should use a private constructor — use a static factory method.',
      'warning',
      undefined,
    ),
  ];
}

function checkApplicationImports(imports: Array<{ path: string; line: number }>): ArchViolation[] {
  return imports
    .filter((i) => i.path.includes('/presentation') || i.path.includes('/controllers'))
    .map((i) =>
      makeViolation(
        'APP_NO_PRESENTATION',
        `Application layer must not import from presentation: '${i.path}'`,
        'error',
        i.line,
      ),
    );
}

function checkPublicMutableFields(source: string): ArchViolation[] {
  const hasPublicField = /^\s+(?:public\s+)?[a-z]\w+\s*[=:]/m.test(source);
  const isValueObject = /(?:extends|implements)\s+\w*ValueObject/.test(source);
  if (!isValueObject || !hasPublicField) {
    return [];
  }
  return [
    makeViolation('VO_IMMUTABLE', 'Value Object fields should be readonly.', 'warning', undefined),
  ];
}

function violationsForLayer(
  layer: ArchLayer,
  source: string,
  imports: Array<{ path: string; line: number }>,
): ArchViolation[] {
  if (layer === 'domain') {
    return [
      ...checkDomainImports(imports),
      ...checkMissingPrivateConstructor(source),
      ...checkPublicMutableFields(source),
    ];
  }
  if (layer === 'application') {
    return checkApplicationImports(imports);
  }
  return [];
}

function buildResult(file: string, violations: ArchViolation[]): ValidationResult {
  const errorCount = violations.filter((v) => v.severity === 'error').length;
  const warningCount = violations.filter((v) => v.severity === 'warning').length;
  return { file, violations, passed: errorCount === 0, errorCount, warningCount };
}

/**
 * Architecture validator using heuristic text analysis.
 * Enforces DDD layering rules and common structural anti-patterns.
 */
export class ArchitectureValidator {
  /** Validate a single TypeScript source file. */
  validate(filePath: string, source: string): ValidationResult {
    const layer = detectLayer(filePath);
    const imports = getImportPaths(source);
    const violations = violationsForLayer(layer, source, imports);
    return buildResult(filePath, violations);
  }

  /** Detect which architecture layer a file belongs to by its path. */
  detectLayer(filePath: string): ArchLayer {
    return detectLayer(filePath);
  }

  /** Validate multiple files and aggregate results. */
  validateProject(files: ReadonlyArray<{ path: string; source: string }>): ProjectValidationResult {
    const results = files.map((f) => this.validate(f.path, f.source));
    const totalErrors = results.reduce((s, r) => s + r.errorCount, 0);
    const totalWarnings = results.reduce((s, r) => s + r.warningCount, 0);
    return {
      results,
      totalErrors,
      totalWarnings,
      passed: totalErrors === 0,
      fileCount: results.length,
    };
  }

  /** Returns true when all checked files pass without errors. */
  isValid(filePath: string, source: string): boolean {
    return this.validate(filePath, source).passed;
  }
}
