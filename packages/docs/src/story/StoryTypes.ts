/**
 * Core story types for interactive documentation of @acme components.
 * Mirrors the Storybook Meta / StoryObj pattern for pure TypeScript libraries.
 */

/** Arbitrary key-value arguments passed to a story's execute function. */
export type StoryArgs = Record<string, unknown>;

/** The lifecycle status of a story execution. */
export type StoryStatus = 'pass' | 'fail' | 'skip';

/** Metadata that describes a whole component/module story collection. */
export interface StoryMeta<TSubject = unknown> {
  /** Human-readable title shown in catalog listings. */
  readonly title: string;
  /** Detailed description of what the component does. */
  readonly description: string;
  /** Unique component key used for registry lookups. */
  readonly component: string;
  /** Searchable tags (e.g. 'value-object', 'ddd', 'result'). */
  readonly tags: readonly string[];
  /** Factory that creates a fresh subject instance for every story run. */
  readonly create: () => TSubject;
}

/** A single documented example — the TypeScript equivalent of a Storybook story. */
export interface StoryDef<TSubject = unknown, TArgs extends StoryArgs = StoryArgs> {
  /** Unique name within the module. */
  readonly name: string;
  /** What this story demonstrates. */
  readonly description: string;
  /** Input arguments forwarded to execute. */
  readonly args: TArgs;
  /** Runs the story and returns an observable result. */
  readonly execute: (subject: TSubject, args: TArgs) => unknown;
  /** Human-readable description of the expected outcome. */
  readonly expectedOutcome: string;
}

/** Groups a StoryMeta with its collection of StoreDefs. */
export interface StoryModule<TSubject = unknown, TArgs extends StoryArgs = StoryArgs> {
  readonly meta: StoryMeta<TSubject>;
  readonly stories: ReadonlyArray<StoryDef<TSubject, TArgs>>;
}

/** The result of executing a single StoryDef. */
export interface StoryResult {
  readonly name: string;
  readonly status: StoryStatus;
  readonly output: unknown;
  readonly error: string | undefined;
  readonly durationMs: number;
}

/** Aggregated results for an entire StoryModule run. */
export interface ModuleResult {
  readonly title: string;
  readonly component: string;
  readonly results: readonly StoryResult[];
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly total: number;
}

/** Lightweight catalog entry for discovery / listing purposes. */
export interface CatalogEntry {
  readonly title: string;
  readonly description: string;
  readonly component: string;
  readonly storyCount: number;
  readonly tags: readonly string[];
}

/** Summary across all modules. */
export interface DocsSummary {
  readonly modules: number;
  readonly totalStories: number;
  readonly tags: readonly string[];
}
