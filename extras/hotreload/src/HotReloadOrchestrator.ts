import type {
  WatchConfig,
  WatchEvent,
  WatchMode,
  OrchestratorState,
  OrchestratorStatus,
  CompileResult,
  TestRefreshResult,
} from './WatchTypes';
import { WatchManager } from './WatchManager';
import { IncrementalCompiler } from './IncrementalCompiler';
import { TestRefresher } from './TestRefresher';

function affectedMode(events: readonly WatchEvent[], mode: WatchMode): readonly string[] {
  if (mode === 'compile') {
    return events.filter((e) => e.kind !== 'remove').map((e) => e.path);
  }
  if (mode === 'test') {
    return events.map((e) => e.path);
  }
  return events.map((e) => e.path);
}

export class HotReloadOrchestrator {
  private readonly watchManager: WatchManager;
  private readonly compiler: IncrementalCompiler;
  private readonly refresher: TestRefresher;
  private status: OrchestratorStatus = 'idle';
  private lastCompile: CompileResult | undefined = undefined;
  private lastTestRun: TestRefreshResult | undefined = undefined;
  private watchedCount = 0;

  constructor(config: WatchConfig) {
    this.watchManager = new WatchManager(config);
    this.compiler = new IncrementalCompiler();
    this.refresher = new TestRefresher();
  }

  /** Start watching — transitions to 'watching' state. */
  start(): void {
    this.status = 'watching';
  }

  /** Stop watching — transitions back to 'idle'. */
  stop(): void {
    this.status = 'idle';
  }

  /** Register a source file and its imports for incremental compilation. */
  registerFile(file: string, imports: readonly string[]): void {
    this.compiler.register(file, imports);
    this.watchedCount += 1;
  }

  /** Register test file mappings. */
  registerTestFiles(tests: readonly string[]): void {
    this.refresher.addTestFiles(tests);
  }

  /** Link a source file to its covering test files. */
  mapTests(sourceFile: string, testFiles: readonly string[]): void {
    this.refresher.mapSourceToTests(sourceFile, testFiles);
  }

  /** Process an incoming file-system event end-to-end. */
  handleEvent(event: WatchEvent, now: number = Date.now()): void {
    if (this.status !== 'watching') return;
    const matched = this.watchManager.receive(event);
    if (matched.length === 0) return;

    const flushed = this.watchManager.flush(now + 1);
    for (const entry of flushed) {
      const paths = affectedMode(entry.events, entry.pattern.mode);
      this.runAffected(paths, entry.pattern.mode);
    }
  }

  private runAffected(paths: readonly string[], mode: WatchMode): void {
    if (mode === 'compile' || mode === 'both') {
      this.runCompile(paths);
    }
    if (mode === 'test' || mode === 'both') {
      this.runTests(paths);
    }
  }

  private runCompile(paths: readonly string[]): void {
    this.status = 'compiling';
    for (const p of paths) this.compiler.markDirty(p);
    this.lastCompile = this.compiler.compile();
    this.status = 'watching';
  }

  private runTests(paths: readonly string[]): void {
    this.status = 'testing';
    this.lastTestRun = this.refresher.refresh(paths);
    this.status = 'watching';
  }

  /** Force a full recompile of all registered files. */
  recompileAll(): CompileResult {
    this.compiler.invalidateAll();
    this.lastCompile = this.compiler.compile();
    return this.lastCompile;
  }

  /** Current snapshot of the orchestrator state. */
  state(): OrchestratorState {
    return {
      status: this.status,
      watchedFiles: this.watchedCount,
      lastCompile: this.lastCompile,
      lastTestRun: this.lastTestRun,
    };
  }

  /** Access the underlying compiler (for testing). */
  getCompiler(): IncrementalCompiler {
    return this.compiler;
  }

  /** Access the underlying refresher (for testing). */
  getRefresher(): TestRefresher {
    return this.refresher;
  }
}
