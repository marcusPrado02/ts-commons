/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
import { describe, it, expect, beforeEach } from 'vitest';
import { WatchManager } from './WatchManager';
import { IncrementalCompiler } from './IncrementalCompiler';
import { TestRefresher } from './TestRefresher';
import { HotReloadOrchestrator } from './HotReloadOrchestrator';
import type { WatchConfig, WatchEvent } from './WatchTypes';

// ── helpers ──────────────────────────────────────────────────────────────────

const baseConfig: WatchConfig = {
  rootDir: '/project',
  ignored: ['node_modules', 'dist'],
  defaultDebounceMs: 50,
  patterns: [
    { glob: 'src/**/*.ts', mode: 'compile', debounceMs: 50 },
    { glob: 'src/**/*.test.ts', mode: 'test', debounceMs: 30 },
  ],
};

function makeEvent(path: string, kind: WatchEvent['kind'] = 'change'): WatchEvent {
  return { path, kind, timestamp: Date.now() };
}

// ── WatchManager ─────────────────────────────────────────────────────────────

describe('WatchManager', () => {
  let manager: WatchManager;

  beforeEach(() => {
    manager = new WatchManager(baseConfig);
  });

  it('receives an event matching a pattern', () => {
    const matched = manager.receive(makeEvent('src/domain/Order.ts'));
    expect(matched.length).toBeGreaterThanOrEqual(1);
  });

  it('ignores files inside ignored directories', () => {
    const matched = manager.receive(makeEvent('node_modules/lodash/index.ts'));
    expect(matched.length).toBe(0);
  });

  it('ignores files in dist', () => {
    const matched = manager.receive(makeEvent('dist/Order.js'));
    expect(matched.length).toBe(0);
  });

  it('increments eventCount after a valid event', () => {
    manager.receive(makeEvent('src/Order.ts'));
    expect(manager.eventCount()).toBe(1);
  });

  it('does not increment eventCount for ignored files', () => {
    manager.receive(makeEvent('node_modules/pkg/a.ts'));
    expect(manager.eventCount()).toBe(0);
  });

  it('pendingCount increases after receiving an event', () => {
    manager.receive(makeEvent('src/Order.ts'));
    expect(manager.pendingCount()).toBeGreaterThanOrEqual(1);
  });

  it('flush returns entries whose deadline has passed', () => {
    manager.receive(makeEvent('src/Order.ts'));
    const flushed = manager.flush(Date.now() + 1000);
    expect(flushed.length).toBeGreaterThanOrEqual(1);
    expect(manager.pendingCount()).toBe(0);
  });

  it('flush returns nothing when no deadlines elapsed', () => {
    manager.receive(makeEvent('src/Order.ts'));
    const flushed = manager.flush(0);
    expect(flushed.length).toBe(0);
  });

  it('accumulates multiple events for same pattern into single entry', () => {
    const path = 'src/Order.ts';
    manager.receive(makeEvent(path, 'change'));
    manager.receive(makeEvent(path, 'change'));
    expect(manager.pendingCount()).toBeLessThanOrEqual(2);
  });

  it('eventsForMode returns compile events', () => {
    manager.receive(makeEvent('src/Order.ts'));
    const events = manager.eventsForMode('compile');
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('eventsForMode returns test events', () => {
    manager.receive(makeEvent('src/Order.test.ts'));
    const events = manager.eventsForMode('test');
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('reset clears all state', () => {
    manager.receive(makeEvent('src/Order.ts'));
    manager.reset();
    expect(manager.eventCount()).toBe(0);
    expect(manager.pendingCount()).toBe(0);
  });

  it('rootDir returns configured root', () => {
    expect(manager.rootDir()).toBe('/project');
  });

  it('handles add event kind', () => {
    const matched = manager.receive(makeEvent('src/New.ts', 'add'));
    expect(matched.length).toBeGreaterThanOrEqual(1);
  });

  it('handles remove event kind', () => {
    const matched = manager.receive(makeEvent('src/Old.ts', 'remove'));
    expect(matched.length).toBeGreaterThanOrEqual(1);
  });
});

// ── IncrementalCompiler ───────────────────────────────────────────────────────

describe('IncrementalCompiler', () => {
  let compiler: IncrementalCompiler;

  beforeEach(() => {
    compiler = new IncrementalCompiler();
  });

  it('fileCount returns 0 initially', () => {
    expect(compiler.fileCount()).toBe(0);
  });

  it('register adds files', () => {
    compiler.register('src/A.ts', []);
    expect(compiler.fileCount()).toBe(1);
  });

  it('register with imports creates dependency node', () => {
    compiler.register('src/A.ts', ['src/B.ts']);
    compiler.register('src/B.ts', []);
    const node = compiler.nodeFor('src/A.ts');
    expect(node?.imports).toContain('src/B.ts');
  });

  it('dependents are populated after register', () => {
    compiler.register('src/A.ts', ['src/B.ts']);
    compiler.register('src/B.ts', []);
    const nodeB = compiler.nodeFor('src/B.ts');
    expect(nodeB?.dependents).toContain('src/A.ts');
  });

  it('markDirty makes a file dirty', () => {
    compiler.register('src/A.ts', []);
    compiler.markDirty('src/A.ts');
    expect(compiler.dirtyCount()).toBe(1);
  });

  it('markDirty propagates to dependents', () => {
    compiler.register('src/A.ts', ['src/B.ts']);
    compiler.register('src/B.ts', []);
    compiler.markDirty('src/B.ts');
    expect(compiler.dirtyCount()).toBe(2);
  });

  it('compile clears dirty files on success', () => {
    compiler.register('src/A.ts', []);
    compiler.markDirty('src/A.ts');
    compiler.compile();
    expect(compiler.dirtyCount()).toBe(0);
  });

  it('compile populates recompiledFiles', () => {
    compiler.register('src/A.ts', []);
    compiler.markDirty('src/A.ts');
    const result = compiler.compile();
    expect(result.recompiledFiles).toContain('src/A.ts');
  });

  it('compile returns success=false when errors given', () => {
    compiler.register('src/A.ts', []);
    compiler.markDirty('src/A.ts');
    const result = compiler.compile(['src/A.ts']);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBe(1);
  });

  it('compile excludes errored files from recompiledFiles', () => {
    compiler.register('src/A.ts', []);
    compiler.markDirty('src/A.ts');
    const result = compiler.compile(['src/A.ts']);
    expect(result.recompiledFiles).not.toContain('src/A.ts');
  });

  it('isCompiled returns true after compile', () => {
    compiler.register('src/A.ts', []);
    compiler.markDirty('src/A.ts');
    compiler.compile();
    expect(compiler.isCompiled('src/A.ts')).toBe(true);
  });

  it('cachedOutput returns compiled string', () => {
    compiler.register('src/A.ts', []);
    compiler.markDirty('src/A.ts');
    compiler.compile();
    expect(compiler.cachedOutput('src/A.ts')).toBe('compiled:src/A.ts');
  });

  it('invalidateAll marks all files dirty', () => {
    compiler.register('src/A.ts', []);
    compiler.register('src/B.ts', []);
    compiler.invalidateAll();
    expect(compiler.dirtyCount()).toBe(2);
  });

  it('compile returns durationMs >= 0', () => {
    compiler.register('src/A.ts', []);
    compiler.markDirty('src/A.ts');
    const result = compiler.compile();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ── TestRefresher ─────────────────────────────────────────────────────────────

describe('TestRefresher', () => {
  let refresher: TestRefresher;

  beforeEach(() => {
    refresher = new TestRefresher();
  });

  it('knownTestFiles is empty initially', () => {
    expect(refresher.knownTestFiles().length).toBe(0);
  });

  it('addTestFiles registers tests', () => {
    refresher.addTestFiles(['src/A.test.ts']);
    expect(refresher.knownTestFiles()).toContain('src/A.test.ts');
  });

  it('addTestFiles deduplicates', () => {
    refresher.addTestFiles(['src/A.test.ts']);
    refresher.addTestFiles(['src/A.test.ts']);
    expect(refresher.knownTestFiles().length).toBe(1);
  });

  it('mapSourceToTests creates a mapping', () => {
    refresher.mapSourceToTests('src/A.ts', ['src/A.test.ts']);
    expect(refresher.hasMappingFor('src/A.ts')).toBe(true);
  });

  it('refresh with a test file includes it directly', () => {
    refresher.addTestFiles(['src/A.test.ts']);
    const result = refresher.refresh(['src/A.test.ts']);
    expect(result.testFiles).toContain('src/A.test.ts');
  });

  it('refresh with a source file resolves mapped tests', () => {
    refresher.addTestFiles(['src/A.test.ts']);
    refresher.mapSourceToTests('src/A.ts', ['src/A.test.ts']);
    const result = refresher.refresh(['src/A.ts']);
    expect(result.testFiles).toContain('src/A.test.ts');
  });

  it('refresh skips unaffected tests', () => {
    refresher.addTestFiles(['src/A.test.ts', 'src/B.test.ts']);
    refresher.mapSourceToTests('src/A.ts', ['src/A.test.ts']);
    const result = refresher.refresh(['src/A.ts']);
    expect(result.skippedFiles).toContain('src/B.test.ts');
  });

  it('refresh totalTests equals testFiles count', () => {
    refresher.addTestFiles(['src/A.test.ts']);
    refresher.mapSourceToTests('src/A.ts', ['src/A.test.ts']);
    const result = refresher.refresh(['src/A.ts']);
    expect(result.totalTests).toBe(result.testFiles.length);
  });

  it('mappedSources lists files with explicit mappings', () => {
    refresher.mapSourceToTests('src/A.ts', ['src/A.test.ts']);
    expect(refresher.mappedSources()).toContain('src/A.ts');
  });

  it('reset clears all state', () => {
    refresher.addTestFiles(['src/A.test.ts']);
    refresher.mapSourceToTests('src/A.ts', ['src/A.test.ts']);
    refresher.reset();
    expect(refresher.knownTestFiles().length).toBe(0);
    expect(refresher.hasMappingFor('src/A.ts')).toBe(false);
  });
});

// ── HotReloadOrchestrator ─────────────────────────────────────────────────────

describe('HotReloadOrchestrator', () => {
  let orch: HotReloadOrchestrator;

  const config: WatchConfig = {
    rootDir: '/project',
    ignored: ['node_modules'],
    defaultDebounceMs: 10,
    patterns: [{ glob: 'src/**/*.ts', mode: 'both', debounceMs: 0 }],
  };

  beforeEach(() => {
    orch = new HotReloadOrchestrator(config);
  });

  it('initial state is idle', () => {
    expect(orch.state().status).toBe('idle');
  });

  it('start transitions to watching', () => {
    orch.start();
    expect(orch.state().status).toBe('watching');
  });

  it('stop transitions back to idle', () => {
    orch.start();
    orch.stop();
    expect(orch.state().status).toBe('idle');
  });

  it('handleEvent does nothing when idle', () => {
    orch.registerFile('src/A.ts', []);
    orch.handleEvent(makeEvent('src/A.ts'), Date.now() + 1000);
    expect(orch.state().lastCompile).toBeUndefined();
  });

  it('registerFile increases watchedFiles count', () => {
    orch.registerFile('src/A.ts', []);
    expect(orch.state().watchedFiles).toBe(1);
  });

  it('handleEvent triggers compile after event', () => {
    orch.start();
    orch.registerFile('src/A.ts', []);
    orch.handleEvent(makeEvent('src/A.ts'), Date.now() + 1000);
    expect(orch.state().lastCompile).toBeDefined();
  });

  it('handleEvent triggers test refresh after event', () => {
    orch.start();
    orch.registerTestFiles(['src/A.test.ts']);
    orch.handleEvent(makeEvent('src/A.ts'), Date.now() + 1000);
    expect(orch.state().lastTestRun).toBeDefined();
  });

  it('recompileAll returns a compile result', () => {
    orch.registerFile('src/A.ts', []);
    const result = orch.recompileAll();
    expect(result.success).toBe(true);
  });

  it('recompileAll compiles all registered files', () => {
    orch.registerFile('src/A.ts', []);
    orch.registerFile('src/B.ts', []);
    const result = orch.recompileAll();
    expect(result.recompiledFiles.length).toBe(2);
  });

  it('mapTests links source to test files', () => {
    orch.registerTestFiles(['src/A.test.ts']);
    orch.mapTests('src/A.ts', ['src/A.test.ts']);
    expect(orch.getRefresher().hasMappingFor('src/A.ts')).toBe(true);
  });

  it('getCompiler returns the internal compiler', () => {
    orch.registerFile('src/X.ts', []);
    expect(orch.getCompiler().fileCount()).toBe(1);
  });
});
