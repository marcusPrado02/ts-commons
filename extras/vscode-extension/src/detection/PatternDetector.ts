import type { DddPattern, PatternMatch, PatternReport, PatternRule } from './PatternTypes';

const RULES: ReadonlyArray<PatternRule> = [
  {
    pattern: 'entity',
    regex: /class\s+(\w+)\s+(?:extends\s+\w*Entity|implements\s+\w*Entity)/,
    description: 'DDD Entity — has identity and lifecycle',
  },
  {
    pattern: 'value-object',
    regex: /class\s+(\w+)\s+(?:extends\s+\w*ValueObject|implements\s+\w*ValueObject)/,
    description: 'DDD Value Object — immutable, equality by value',
  },
  {
    pattern: 'aggregate',
    regex: /class\s+(\w+)\s+(?:extends\s+\w*Aggregate|implements\s+\w*Aggregate)/,
    description: 'DDD Aggregate Root — consistency boundary',
  },
  {
    pattern: 'domain-event',
    regex: /class\s+(\w+(?:Event|Created|Updated|Deleted|Changed))\b/,
    description: 'DDD Domain Event — records a fact that occurred',
  },
  {
    pattern: 'repository',
    regex: /(?:interface|class)\s+(\w+Repository)\b/,
    description: 'DDD Repository — persistence abstraction',
  },
  {
    pattern: 'use-case',
    regex: /class\s+(\w+(?:UseCase|Interactor|Handler|Command))\b/,
    description: 'DDD Use Case — application-layer orchestration',
  },
  {
    pattern: 'domain-service',
    regex: /class\s+(\w+(?:Service|DomainService))\b/,
    description: 'DDD Domain Service — stateless domain logic',
  },
  {
    pattern: 'factory',
    regex: /class\s+(\w+Factory)\b/,
    description: 'DDD Factory — complex object construction',
  },
];

function extractName(match: RegExpMatchArray): string {
  return match[1] ?? match[0];
}

function matchLine(
  lineText: string,
  lineIndex: number,
  rule: PatternRule,
): PatternMatch | undefined {
  const result = rule.regex.exec(lineText);
  if (result === null) {
    return undefined;
  }
  return {
    pattern: rule.pattern,
    name: extractName(result),
    line: lineIndex + 1,
    description: rule.description,
  };
}

function scanLine(lineText: string, lineIndex: number): PatternMatch[] {
  const matches: PatternMatch[] = [];
  for (const rule of RULES) {
    const m = matchLine(lineText, lineIndex, rule);
    if (m !== undefined) {
      matches.push(m);
    }
  }
  return matches;
}

function countPattern(matches: readonly PatternMatch[], pattern: DddPattern): number {
  return matches.filter((m) => m.pattern === pattern).length;
}

function buildReport(matches: PatternMatch[]): PatternReport {
  const entityCount = countPattern(matches, 'entity');
  const valueObjectCount = countPattern(matches, 'value-object');
  const aggregateCount = countPattern(matches, 'aggregate');
  const eventCount = countPattern(matches, 'domain-event');
  const repositoryCount = countPattern(matches, 'repository');
  const useCaseCount = countPattern(matches, 'use-case');
  return {
    matches,
    entityCount,
    valueObjectCount,
    aggregateCount,
    eventCount,
    repositoryCount,
    useCaseCount,
    hasDomainLayer: entityCount + valueObjectCount + aggregateCount + eventCount > 0,
    hasApplicationLayer: useCaseCount > 0,
  };
}

/**
 * Scans TypeScript source text for DDD patterns using regex heuristics.
 * Designed for fast editor-side analysis — not a full AST parser.
 */
export class PatternDetector {
  /** Detect all DDD patterns in a block of TypeScript source code. */
  detect(source: string): PatternReport {
    const lines = source.split('\n');
    const matches: PatternMatch[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      matches.push(...scanLine(line, i));
    }
    return buildReport(matches);
  }

  /** Returns whether any DDD pattern appears in the source. */
  hasDddPatterns(source: string): boolean {
    const report = this.detect(source);
    return report.matches.length > 0;
  }

  /** Find all matches of a specific pattern kind. */
  findByPattern(source: string, pattern: DddPattern): readonly PatternMatch[] {
    return this.detect(source).matches.filter((m) => m.pattern === pattern);
  }

  /** List all unique class names detected across all patterns. */
  listNames(source: string): string[] {
    return [...new Set(this.detect(source).matches.map((m) => m.name))];
  }
}
