import { StoryRegistry } from '../story/StoryRegistry';
import { StoryRunner } from '../story/StoryRunner';
import type {
  CatalogEntry,
  DocsSummary,
  ModuleResult,
  StoryArgs,
  StoryModule,
} from '../story/StoryTypes';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModule = StoryModule<any, StoryArgs>;

/**
 * High-level interactive documentation catalog.
 * Groups a StoryRegistry + StoryRunner and adds discovery helpers
 * that feel similar to Storybook's web navigation.
 */
export class ComponentCatalog {
  private readonly registry = new StoryRegistry();
  private readonly runner = new StoryRunner();

  /** Register one or more story modules in the catalog. */
  add(...modules: AnyModule[]): void {
    for (const m of modules) {
      this.registry.register(m);
    }
  }

  /** Browse all entries without running stories. */
  browse(): CatalogEntry[] {
    return this.registry.catalog();
  }

  /** Browse entries matching a tag. */
  browseByTag(tag: string): CatalogEntry[] {
    return this.registry.getByTag(tag).map((m) => ({
      title: m.meta.title,
      description: m.meta.description,
      component: m.meta.component,
      storyCount: m.stories.length,
      tags: m.meta.tags,
    }));
  }

  /** All registered component keys. */
  components(): string[] {
    return this.registry.componentNames();
  }

  /** Number of registered modules. */
  size(): number {
    return this.registry.count();
  }

  /** Total story count across all modules. */
  storyCount(): number {
    return this.registry.totalStories();
  }

  /** High-level summary. */
  summary(): DocsSummary {
    return this.registry.summary();
  }

  /** Run all stories for a specific component. */
  run(component: string): ModuleResult | undefined {
    const module = this.registry.get(component);
    if (module === undefined) {
      return undefined;
    }
    return this.runner.run(module);
  }

  /** Run every registered story module. */
  runAll(): ModuleResult[] {
    return this.runner.runAll(this.registry.getAll());
  }

  /** Run all modules and return aggregated pass/fail/skip totals. */
  runAndSummarize(): {
    results: ModuleResult[];
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  } {
    const results = this.runAll();
    const totals = this.runner.summarize(results);
    return { results, ...totals };
  }

  /** Search for modules whose title or description matches the query. */
  search(query: string): CatalogEntry[] {
    return this.registry.search(query).map((m) => ({
      title: m.meta.title,
      description: m.meta.description,
      component: m.meta.component,
      storyCount: m.stories.length,
      tags: m.meta.tags,
    }));
  }

  /** Whether a component is registered. */
  has(component: string): boolean {
    return this.registry.has(component);
  }

  /** Remove a component from the catalog. */
  remove(component: string): boolean {
    return this.registry.remove(component);
  }

  /** Clear all registered modules. */
  clear(): void {
    this.registry.clear();
  }
}
