import type { ModuleResult, StoryArgs, StoryDef, StoryModule, StoryResult } from './StoryTypes';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModule = StoryModule<any, StoryArgs>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyStory = StoryDef<any, StoryArgs>;

/** Executes story modules and collects results. */
export class StoryRunner {
  /** Run every story in a module and aggregate the results. */
  run(module: AnyModule): ModuleResult {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const subject = module.meta.create();
    const results: StoryResult[] = module.stories.map((story) => this.runStory(subject, story));
    return this.buildModuleResult(module, results);
  }

  private buildModuleResult(module: AnyModule, results: StoryResult[]): ModuleResult {
    const passed = results.filter((r) => r.status === 'pass').length;
    const failed = results.filter((r) => r.status === 'fail').length;
    const skipped = results.filter((r) => r.status === 'skip').length;
    return {
      title: module.meta.title,
      component: module.meta.component,
      results,
      passed,
      failed,
      skipped,
      total: results.length,
    };
  }

  private runStory(subject: unknown, story: AnyStory): StoryResult {
    const start = Date.now();
    try {
      const output = story.execute(subject, story.args);
      return {
        name: story.name,
        status: 'pass',
        output,
        error: undefined,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return {
        name: story.name,
        status: 'fail',
        output: undefined,
        error,
        durationMs: Date.now() - start,
      };
    }
  }

  /** Run all provided modules and return one ModuleResult per module. */
  runAll(modules: ReadonlyArray<AnyModule>): ModuleResult[] {
    return modules.map((m) => this.run(m));
  }

  /**
   * Run only the stories whose name matches the filter predicate.
   * Stories that do not match are marked as 'skip'.
   */
  runFiltered(module: AnyModule, filter: (name: string) => boolean): ModuleResult {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const subject = module.meta.create();
    const results: StoryResult[] = module.stories.map((story) => {
      if (!filter(story.name)) {
        return this.skipStory(story.name);
      }
      return this.runStory(subject, story);
    });
    return this.buildModuleResult(module, results);
  }

  private skipStory(name: string): StoryResult {
    return { name, status: 'skip', output: undefined, error: undefined, durationMs: 0 };
  }

  /** Aggregate totals across multiple ModuleResults. */
  summarize(results: readonly ModuleResult[]): {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  } {
    return {
      total: results.reduce((s, r) => s + r.total, 0),
      passed: results.reduce((s, r) => s + r.passed, 0),
      failed: results.reduce((s, r) => s + r.failed, 0),
      skipped: results.reduce((s, r) => s + r.skipped, 0),
    };
  }

  /** Returns true only if all stories across all modules passed. */
  allPassed(results: readonly ModuleResult[]): boolean {
    return results.every((r) => r.failed === 0);
  }
}
