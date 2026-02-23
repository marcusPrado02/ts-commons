import type { CatalogEntry, DocsSummary, StoryArgs, StoryModule } from './StoryTypes';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModule = StoryModule<any, StoryArgs>;

/**
 * Central registry that stores and retrieves StoryModules by component key.
 * Analogous to Storybook's story file discovery mechanism.
 */
export class StoryRegistry {
  private readonly modules = new Map<string, AnyModule>();

  /** Register a story module. Overwrites any existing entry for the same component. */
  register<T, A extends StoryArgs>(module: StoryModule<T, A>): void {
    this.modules.set(module.meta.component, module as AnyModule);
  }

  /** Whether a module is registered for the given component key. */
  has(component: string): boolean {
    return this.modules.has(component);
  }

  /** Retrieve a module by component key. Returns undefined if not found. */
  get(component: string): AnyModule | undefined {
    return this.modules.get(component);
  }

  /** All registered modules as an immutable array. */
  getAll(): ReadonlyArray<AnyModule> {
    return Array.from(this.modules.values());
  }

  /** Filter modules by tag. */
  getByTag(tag: string): ReadonlyArray<AnyModule> {
    return this.getAll().filter((m) => m.meta.tags.includes(tag));
  }

  /** Filter modules whose title contains the given search string (case-insensitive). */
  search(query: string): ReadonlyArray<AnyModule> {
    const lower = query.toLowerCase();
    return this.getAll().filter(
      (m) =>
        m.meta.title.toLowerCase().includes(lower) ||
        m.meta.description.toLowerCase().includes(lower),
    );
  }

  /** All registered component keys. */
  componentNames(): string[] {
    return Array.from(this.modules.keys());
  }

  /** Number of registered modules. */
  count(): number {
    return this.modules.size;
  }

  /** Total number of stories across all modules. */
  totalStories(): number {
    return this.getAll().reduce((sum, m) => sum + m.stories.length, 0);
  }

  /** Build a lightweight catalog entry for a module. */
  toCatalogEntry(component: string): CatalogEntry | undefined {
    const module = this.modules.get(component);
    if (module === undefined) {
      return undefined;
    }
    return {
      title: module.meta.title,
      description: module.meta.description,
      component: module.meta.component,
      storyCount: module.stories.length,
      tags: module.meta.tags,
    };
  }

  /** All catalog entries. */
  catalog(): CatalogEntry[] {
    return this.componentNames().map((name) => {
      const entry = this.toCatalogEntry(name);
      return entry as CatalogEntry;
    });
  }

  /** High-level summary of the registry. */
  summary(): DocsSummary {
    const allTags = new Set<string>();
    for (const m of this.getAll()) {
      for (const tag of m.meta.tags) {
        allTags.add(tag);
      }
    }
    return {
      modules: this.count(),
      totalStories: this.totalStories(),
      tags: Array.from(allTags).sort(),
    };
  }

  /** Remove a module from the registry. Returns true if it existed. */
  remove(component: string): boolean {
    return this.modules.delete(component);
  }

  /** Clear all registered modules. */
  clear(): void {
    this.modules.clear();
  }
}
