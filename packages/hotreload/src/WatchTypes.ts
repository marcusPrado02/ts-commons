/** How the watcher reacts to file changes. */
export type WatchMode = 'compile' | 'test' | 'both';

/** File-system event kinds emitted by the watch layer. */
export type WatchEventKind = 'add' | 'change' | 'remove';

/** A single file-system event. */
export interface WatchEvent {
  readonly path: string;
  readonly kind: WatchEventKind;
  readonly timestamp: number;
}

/** A pattern rule used to decide which files to watch. */
export interface WatchPattern {
  readonly glob: string;
  readonly mode: WatchMode;
  readonly debounceMs: number;
}

/** Configuration for the WatchManager. */
export interface WatchConfig {
  readonly patterns: readonly WatchPattern[];
  readonly rootDir: string;
  readonly ignored: readonly string[];
  readonly defaultDebounceMs: number;
}

/** Result of a single incremental compilation pass. */
export interface CompileResult {
  readonly changedFiles: readonly string[];
  readonly recompiledFiles: readonly string[];
  readonly durationMs: number;
  readonly errors: readonly string[];
  readonly success: boolean;
}

/** A node in the incremental-compiler dependency graph. */
export interface DependencyNode {
  readonly file: string;
  readonly imports: readonly string[];
  readonly dependents: readonly string[];
}

/** A pending debounce entry. */
export interface DebounceEntry {
  readonly pattern: WatchPattern;
  readonly events: WatchEvent[];
  scheduledAt: number;
}

/** Summary of a fast-refresh test run. */
export interface TestRefreshResult {
  readonly triggeredBy: readonly string[];
  readonly testFiles: readonly string[];
  readonly skippedFiles: readonly string[];
  readonly totalTests: number;
}

/** Overall orchestration status. */
export type OrchestratorStatus = 'idle' | 'watching' | 'compiling' | 'testing' | 'error';

/** Snapshot of the orchestrator state. */
export interface OrchestratorState {
  readonly status: OrchestratorStatus;
  readonly watchedFiles: number;
  readonly lastCompile: CompileResult | undefined;
  readonly lastTestRun: TestRefreshResult | undefined;
}
