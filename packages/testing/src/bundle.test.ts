/* eslint-disable @typescript-eslint/no-unsafe-call -- Vitest mock call patterns */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Vitest mock objects */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- Vitest mock property access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition -- noUncheckedIndexedAccess */
/* eslint-disable @typescript-eslint/explicit-function-return-type -- test helpers */
/* eslint-disable max-lines-per-function -- test files naturally have longer functions */
/**
 * Tests for @acme/testing — bundle size optimization (Item 50)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { BundleSizeChecker } from './bundle/BundleSizeChecker';
import { ExportAuditor } from './bundle/ExportAuditor';
import { DependencyAuditor } from './bundle/DependencyAuditor';
import { TreeShakeChecker } from './bundle/TreeShakeChecker';
import { CodeSplitAnalyzer } from './bundle/CodeSplitAnalyzer';
import type { DependencyInfo } from './bundle/BundleTypes';
import type { Chunk } from './bundle/CodeSplitAnalyzer';

// ── BundleSizeChecker ─────────────────────────────────────────────────────────

describe('BundleSizeChecker', () => {
  let checker: BundleSizeChecker;

  beforeEach(() => {
    checker = new BundleSizeChecker();
  });

  it('checkBudgets() returns empty when no modules registered', () => {
    checker.addBudget({ name: 'x', maxBytes: 1000 });
    expect(checker.checkBudgets()).toHaveLength(0);
  });

  it('checkBudgets() returns empty when all modules are within budget', () => {
    checker.register({ name: 'pkg', sizeBytes: 5000, treeshakeable: true });
    checker.addBudget({ name: 'pkg', maxBytes: 10_000 });
    expect(checker.checkBudgets()).toHaveLength(0);
  });

  it('checkBudgets() returns violation when module exceeds budget', () => {
    checker.register({ name: 'pkg', sizeBytes: 15_000, treeshakeable: true });
    checker.addBudget({ name: 'pkg', maxBytes: 10_000 });
    const violations = checker.checkBudgets();
    expect(violations).toHaveLength(1);
    expect(violations[0]?.module).toBe('pkg');
    expect(violations[0]?.overageBytes).toBe(5000);
  });

  it('getNonTreeshakeable() returns modules with treeshakeable=false', () => {
    checker.register({ name: 'pure', sizeBytes: 1000, treeshakeable: true });
    checker.register({ name: 'impure', sizeBytes: 2000, treeshakeable: false });
    const result = checker.getNonTreeshakeable();
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('impure');
  });

  it('totalSizeBytes() sums all module sizes', () => {
    checker.register({ name: 'a', sizeBytes: 1000, treeshakeable: true });
    checker.register({ name: 'b', sizeBytes: 2000, treeshakeable: true });
    expect(checker.totalSizeBytes()).toBe(3000);
  });

  it('totalSizeBytes() returns 0 when no modules registered', () => {
    expect(checker.totalSizeBytes()).toBe(0);
  });

  it('totalGzippedBytes() returns sum of gzipped sizes', () => {
    checker.register({ name: 'a', sizeBytes: 1000, gzippedBytes: 400, treeshakeable: true });
    checker.register({ name: 'b', sizeBytes: 2000, gzippedBytes: 700, treeshakeable: true });
    expect(checker.totalGzippedBytes()).toBe(1100);
  });

  it('totalGzippedBytes() returns undefined when no gzip data provided', () => {
    checker.register({ name: 'a', sizeBytes: 1000, treeshakeable: true });
    expect(checker.totalGzippedBytes()).toBeUndefined();
  });

  it('getReport() includes all fields', () => {
    checker.register({ name: 'pkg', sizeBytes: 5000, treeshakeable: true });
    checker.addBudget({ name: 'pkg', maxBytes: 4000 });
    const report = checker.getReport();
    expect(report.moduleCount).toBe(1);
    expect(report.totalSizeBytes).toBe(5000);
    expect(report.budgetViolations).toHaveLength(1);
    expect(report.generatedAt).toBeGreaterThan(0);
  });

  it('register() replaces an existing module entry', () => {
    checker.register({ name: 'pkg', sizeBytes: 1000, treeshakeable: false });
    checker.register({ name: 'pkg', sizeBytes: 2000, treeshakeable: true });
    expect(checker.totalSizeBytes()).toBe(2000);
    expect(checker.getNonTreeshakeable()).toHaveLength(0);
  });

  it('removeBudget() removes the budget', () => {
    checker.register({ name: 'pkg', sizeBytes: 99_000, treeshakeable: true });
    checker.addBudget({ name: 'pkg', maxBytes: 1000 });
    checker.removeBudget('pkg');
    expect(checker.checkBudgets()).toHaveLength(0);
  });

  it('clear() resets modules and budgets', () => {
    checker.register({ name: 'pkg', sizeBytes: 1000, treeshakeable: true });
    checker.addBudget({ name: 'pkg', maxBytes: 500 });
    checker.clear();
    expect(checker.moduleCount()).toBe(0);
    expect(checker.checkBudgets()).toHaveLength(0);
  });
});

// ── ExportAuditor ─────────────────────────────────────────────────────────────

describe('ExportAuditor', () => {
  let auditor: ExportAuditor;

  beforeEach(() => {
    auditor = new ExportAuditor();
  });

  it('analyze() returns all-zero result when nothing registered', () => {
    const result = auditor.analyze();
    expect(result.total).toBe(0);
    expect(result.unusedCount).toBe(0);
  });

  it('getUnusedExports() returns all exports when none marked used', () => {
    auditor.registerExport('Foo', 'foo.ts');
    auditor.registerExport('Bar', 'bar.ts');
    expect(auditor.getUnusedExports()).toHaveLength(2);
  });

  it('markUsed() moves export to used list', () => {
    auditor.registerExport('Alpha', 'a.ts');
    auditor.markUsed('Alpha');
    expect(auditor.getUsedExports()).toHaveLength(1);
    expect(auditor.getUnusedExports()).toHaveLength(0);
  });

  it('markUsed() is a no-op for unknown exports', () => {
    auditor.markUsed('Ghost');
    expect(auditor.exportCount()).toBe(0);
  });

  it('registerExports() registers multiple exports at once', () => {
    auditor.registerExports(['A', 'B', 'C'], 'file.ts');
    expect(auditor.exportCount()).toBe(3);
  });

  it('markUsedAll() marks multiple exports as used', () => {
    auditor.registerExports(['X', 'Y', 'Z'], 'file.ts');
    auditor.markUsedAll(['X', 'Z']);
    expect(auditor.getUsedExports()).toHaveLength(2);
    expect(auditor.getUnusedExports()).toHaveLength(1);
    expect(auditor.getUnusedExports()[0]?.name).toBe('Y');
  });

  it('getExportsByFile() returns only exports from that file', () => {
    auditor.registerExport('A', 'src/a.ts');
    auditor.registerExport('B', 'src/b.ts');
    const results = auditor.getExportsByFile('src/a.ts');
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('A');
  });

  it('analyze() provides correct counts', () => {
    auditor.registerExports(['P', 'Q', 'R'], 'pkg.ts');
    auditor.markUsed('P');
    const result = auditor.analyze();
    expect(result.total).toBe(3);
    expect(result.usedCount).toBe(1);
    expect(result.unusedCount).toBe(2);
    expect(result.unusedExports).toHaveLength(2);
  });

  it('usageRatio() equals 1 when no exports registered', () => {
    expect(auditor.usageRatio()).toBe(1);
  });

  it('usageRatio() calculates fraction of used exports', () => {
    auditor.registerExports(['A', 'B', 'C', 'D'], 'f.ts');
    auditor.markUsedAll(['A', 'B']);
    expect(auditor.usageRatio()).toBe(0.5);
  });

  it('clear() removes all registrations', () => {
    auditor.registerExport('X', 'x.ts');
    auditor.clear();
    expect(auditor.exportCount()).toBe(0);
  });
});

// ── DependencyAuditor ─────────────────────────────────────────────────────────

describe('DependencyAuditor', () => {
  let depAuditor: DependencyAuditor;

  const dep = (name: string, sizeBytes: number, transitive = false): DependencyInfo => ({
    name,
    version: '1.0.0',
    sizeBytes,
    transitive,
  });

  beforeEach(() => {
    depAuditor = new DependencyAuditor();
  });

  it('getAll() returns empty when nothing registered', () => {
    expect(depAuditor.getAll()).toHaveLength(0);
  });

  it('register() stores a dependency', () => {
    depAuditor.register(dep('lodash', 500_000));
    expect(depAuditor.dependencyCount()).toBe(1);
  });

  it('findHeavy() returns deps above threshold sorted largest first', () => {
    depAuditor.register(dep('big', 300_000));
    depAuditor.register(dep('small', 50_000));
    depAuditor.register(dep('medium', 200_000));
    const heavy = depAuditor.findHeavy(100_000);
    expect(heavy).toHaveLength(2);
    expect(heavy[0]?.name).toBe('big');
    expect(heavy[1]?.name).toBe('medium');
  });

  it('findHeavy() returns empty when all deps are small', () => {
    depAuditor.register(dep('tiny', 1000));
    expect(depAuditor.findHeavy(50_000)).toHaveLength(0);
  });

  it('getDirect() returns only non-transitive deps', () => {
    depAuditor.register(dep('direct', 1000, false));
    depAuditor.register(dep('indirect', 2000, true));
    const direct = depAuditor.getDirect();
    expect(direct).toHaveLength(1);
    expect(direct[0]?.name).toBe('direct');
  });

  it('getTransitive() returns only transitive deps', () => {
    depAuditor.register(dep('direct', 1000, false));
    depAuditor.register(dep('trans', 2000, true));
    expect(depAuditor.getTransitive()).toHaveLength(1);
    expect(depAuditor.getTransitive()[0]?.name).toBe('trans');
  });

  it('totalSizeBytes() sums all dep sizes', () => {
    depAuditor.register(dep('a', 1000));
    depAuditor.register(dep('b', 3000));
    expect(depAuditor.totalSizeBytes()).toBe(4000);
  });

  it('find() returns the dep by name', () => {
    depAuditor.register(dep('react', 120_000));
    expect(depAuditor.find('react')?.sizeBytes).toBe(120_000);
  });

  it('find() returns undefined for unknown deps', () => {
    expect(depAuditor.find('ghost')).toBeUndefined();
  });

  it('summarize() aggregates all counts', () => {
    depAuditor.registerAll([dep('a', 200_000, false), dep('b', 50_000, true)]);
    const summary = depAuditor.summarize(100_000);
    expect(summary.totalDependencies).toBe(2);
    expect(summary.directCount).toBe(1);
    expect(summary.transitiveCount).toBe(1);
    expect(summary.totalSizeBytes).toBe(250_000);
    expect(summary.heavyDependencies).toHaveLength(1);
  });

  it('remove() deletes a dependency', () => {
    depAuditor.register(dep('temp', 1000));
    depAuditor.remove('temp');
    expect(depAuditor.dependencyCount()).toBe(0);
  });

  it('clear() empties all deps', () => {
    depAuditor.register(dep('x', 1000));
    depAuditor.clear();
    expect(depAuditor.dependencyCount()).toBe(0);
  });
});

// ── TreeShakeChecker ──────────────────────────────────────────────────────────

describe('TreeShakeChecker', () => {
  let tsc: TreeShakeChecker;

  beforeEach(() => {
    tsc = new TreeShakeChecker();
  });

  it('isPure() returns false for unknown symbols', () => {
    expect(tsc.isPure('Unknown')).toBe(false);
  });

  it('isImpure() returns false for unknown symbols', () => {
    expect(tsc.isImpure('Unknown')).toBe(false);
  });

  it('markPure() makes isPure return true', () => {
    tsc.markPure('Result');
    expect(tsc.isPure('Result')).toBe(true);
    expect(tsc.isImpure('Result')).toBe(false);
  });

  it('markImpure() makes isImpure return true', () => {
    tsc.markImpure('setup');
    expect(tsc.isImpure('setup')).toBe(true);
    expect(tsc.isPure('setup')).toBe(false);
  });

  it('markPureAll() marks multiple symbols at once', () => {
    tsc.markPureAll(['A', 'B', 'C']);
    expect(tsc.symbolCount()).toBe(3);
    expect(tsc.isPure('B')).toBe(true);
  });

  it('markImpureAll() marks multiple symbols at once', () => {
    tsc.markImpureAll(['X', 'Y']);
    expect(tsc.isImpure('X')).toBe(true);
    expect(tsc.isImpure('Y')).toBe(true);
  });

  it('isRegistered() returns true only for known symbols', () => {
    tsc.markPure('Z');
    expect(tsc.isRegistered('Z')).toBe(true);
    expect(tsc.isRegistered('W')).toBe(false);
  });

  it('analyze() categorizes symbols correctly', () => {
    tsc.markPureAll(['A', 'B', 'C']);
    tsc.markImpure('D');
    const analysis = tsc.analyze();
    expect(analysis.treeshakeable).toHaveLength(3);
    expect(analysis.impure).toHaveLength(1);
    expect(analysis.impure[0]).toBe('D');
  });

  it('analyze() purityRatio equals 1 when no symbols registered', () => {
    expect(tsc.analyze().purityRatio).toBe(1);
  });

  it('analyze() purityRatio is 0.75 for 3 pure and 1 impure', () => {
    tsc.markPureAll(['A', 'B', 'C']);
    tsc.markImpure('D');
    expect(tsc.analyze().purityRatio).toBe(0.75);
  });

  it('clear() removes all symbols', () => {
    tsc.markPureAll(['A', 'B']);
    tsc.clear();
    expect(tsc.symbolCount()).toBe(0);
  });

  it('markImpure() overrides markPure for the same symbol', () => {
    tsc.markPure('toggle');
    tsc.markImpure('toggle');
    expect(tsc.isImpure('toggle')).toBe(true);
    expect(tsc.isPure('toggle')).toBe(false);
  });
});

// ── CodeSplitAnalyzer ─────────────────────────────────────────────────────────

describe('CodeSplitAnalyzer', () => {
  let analyzer: CodeSplitAnalyzer;

  const chunk = (name: string, modules: string[], lazy = false): Chunk => ({
    name,
    modules,
    lazy,
  });

  beforeEach(() => {
    analyzer = new CodeSplitAnalyzer();
  });

  it('hasChunk() returns false when chunk not registered', () => {
    expect(analyzer.hasChunk('main')).toBe(false);
  });

  it('addChunk() registers a chunk', () => {
    analyzer.addChunk(chunk('main', ['app']));
    expect(analyzer.hasChunk('main')).toBe(true);
    expect(analyzer.chunkCount()).toBe(1);
  });

  it('removeChunk() deletes a chunk by name', () => {
    analyzer.addChunk(chunk('main', ['app']));
    analyzer.removeChunk('main');
    expect(analyzer.hasChunk('main')).toBe(false);
  });

  it('getLazyChunks() returns only lazy chunks', () => {
    analyzer.addChunk(chunk('main', ['app'], false));
    analyzer.addChunk(chunk('dash', ['charts'], true));
    expect(analyzer.getLazyChunks()).toHaveLength(1);
    expect(analyzer.getLazyChunks()[0]?.name).toBe('dash');
  });

  it('getEagerChunks() returns only non-lazy chunks', () => {
    analyzer.addChunk(chunk('main', ['app'], false));
    analyzer.addChunk(chunk('lazy', [], true));
    expect(analyzer.getEagerChunks()).toHaveLength(1);
    expect(analyzer.getEagerChunks()[0]?.name).toBe('main');
  });

  it('findDuplicatedModules() returns empty when no module appears twice', () => {
    analyzer.addChunk(chunk('a', ['mod1', 'mod2']));
    analyzer.addChunk(chunk('b', ['mod3']));
    expect(analyzer.findDuplicatedModules()).toHaveLength(0);
  });

  it('findDuplicatedModules() detects cross-chunk duplication', () => {
    analyzer.addChunk(chunk('a', ['shared', 'unique-a']));
    analyzer.addChunk(chunk('b', ['shared', 'unique-b']));
    const dupes = analyzer.findDuplicatedModules();
    expect(dupes).toContain('shared');
    expect(dupes).not.toContain('unique-a');
  });

  it('analyze() returns correct chunk counts', () => {
    analyzer.addChunk(chunk('main', ['app'], false));
    analyzer.addChunk(chunk('lazy', ['charts'], true));
    const analysis = analyzer.analyze();
    expect(analysis.totalChunks).toBe(2);
    expect(analysis.lazyChunks).toBe(1);
    expect(analysis.eagerChunks).toBe(1);
  });

  it('analyze() identifies lazy-load candidates from heavy modules', () => {
    analyzer.addChunk(chunk('main', ['app', 'charts', 'tables'], false));
    const analysis = analyzer.analyze(['charts', 'tables']);
    expect(analysis.lazyLoadCandidates).toContain('charts');
    expect(analysis.lazyLoadCandidates).toContain('tables');
  });

  it('analyze() does not flag heavy modules already in lazy chunks', () => {
    analyzer.addChunk(chunk('main', ['app'], false));
    analyzer.addChunk(chunk('charts', ['charts'], true));
    const analysis = analyzer.analyze(['charts']);
    expect(analysis.lazyLoadCandidates).not.toContain('charts');
  });

  it('getChunks() returns all registered chunks', () => {
    analyzer.addChunk(chunk('a', []));
    analyzer.addChunk(chunk('b', []));
    expect(analyzer.getChunks()).toHaveLength(2);
  });

  it('addChunk() replaces existing chunk with same name', () => {
    analyzer.addChunk(chunk('main', ['old']));
    analyzer.addChunk(chunk('main', ['new']));
    expect(analyzer.getChunks()[0]?.modules).toEqual(['new']);
  });

  it('clear() removes all chunks', () => {
    analyzer.addChunk(chunk('a', []));
    analyzer.clear();
    expect(analyzer.chunkCount()).toBe(0);
  });
});
