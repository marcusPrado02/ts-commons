import type { TestRefreshResult } from './WatchTypes';

const TEST_SUFFIXES = ['.test.ts', '.spec.ts', '.test.js', '.spec.js'] as const;

function isTestFile(path: string): boolean {
  return TEST_SUFFIXES.some((s) => path.endsWith(s));
}

function testNameFor(sourcePath: string): string {
  const base = sourcePath.replace(/\.(ts|js)$/, '');
  return `${base}.test.ts`;
}

function resolveTestFiles(
  changed: readonly string[],
  testMap: Map<string, string[]>,
  allTests: readonly string[],
): { testFiles: string[]; skipped: string[] } {
  const needed = new Set<string>();

  for (const file of changed) {
    if (isTestFile(file)) {
      needed.add(file);
      continue;
    }
    const mapped = testMap.get(file);
    if (mapped !== undefined) {
      for (const t of mapped) needed.add(t);
    } else {
      const inferred = testNameFor(file);
      if (allTests.includes(inferred)) {
        needed.add(inferred);
      }
    }
  }

  const skipped = allTests.filter((t) => !needed.has(t));
  return { testFiles: [...needed], skipped };
}

export class TestRefresher {
  /** Map of source file → list of test files that cover it. */
  private readonly testMap = new Map<string, string[]>();
  private readonly knownTests: string[] = [];

  /** Register all known test files. */
  addTestFiles(tests: readonly string[]): void {
    for (const t of tests) {
      if (!this.knownTests.includes(t)) {
        this.knownTests.push(t);
      }
    }
  }

  /** Link a source file to specific test files. */
  mapSourceToTests(sourceFile: string, testFiles: readonly string[]): void {
    const existing = this.testMap.get(sourceFile) ?? [];
    const merged = [...new Set([...existing, ...testFiles])];
    this.testMap.set(sourceFile, merged);
  }

  /**
   * Given a list of changed files, determine which test files to run
   * and which to skip.
   */
  refresh(changedFiles: readonly string[]): TestRefreshResult {
    const { testFiles, skipped } = resolveTestFiles(changedFiles, this.testMap, this.knownTests);
    return {
      triggeredBy: changedFiles,
      testFiles,
      skippedFiles: skipped,
      totalTests: testFiles.length,
    };
  }

  /** Whether any test mapping exists for a source file. */
  hasMappingFor(sourceFile: string): boolean {
    return this.testMap.has(sourceFile);
  }

  /** All currently known test files. */
  knownTestFiles(): readonly string[] {
    return this.knownTests;
  }

  /** All source files that have explicit mappings. */
  mappedSources(): readonly string[] {
    return [...this.testMap.keys()];
  }

  /** Remove all mappings and known tests. */
  reset(): void {
    this.testMap.clear();
    this.knownTests.length = 0;
  }
}
