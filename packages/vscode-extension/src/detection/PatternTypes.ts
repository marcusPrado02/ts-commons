/** A detected DDD pattern occurrence within a source file. */
export interface PatternMatch {
  /** The pattern type detected. */
  readonly pattern: DddPattern;
  /** Original class/type name inferred from source. */
  readonly name: string;
  /** 1-based line number where the pattern was found. */
  readonly line: number;
  /** Human-readable description of what was detected. */
  readonly description: string;
}

/** High-level DDD pattern categories. */
export type DddPattern =
  | 'entity'
  | 'value-object'
  | 'aggregate'
  | 'domain-event'
  | 'repository'
  | 'use-case'
  | 'domain-service'
  | 'factory';
export interface PatternReport {
  readonly matches: readonly PatternMatch[];
  readonly entityCount: number;
  readonly valueObjectCount: number;
  readonly aggregateCount: number;
  readonly eventCount: number;
  readonly repositoryCount: number;
  readonly useCaseCount: number;
  readonly hasDomainLayer: boolean;
  readonly hasApplicationLayer: boolean;
}

/** A simple regex-based rule for detecting a DDD pattern.
 * Kept here only for documentation purposes — see PatternDetector for usage.
 */
export interface PatternRule {
  readonly pattern: DddPattern;
  readonly regex: RegExp;
  readonly description: string;
}
