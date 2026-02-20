import { GraphQLFragmentAlreadyRegisteredError, GraphQLSchemaError } from './GraphQLErrors';
import type { SDLFragment } from './GraphQLTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateFragment(fragment: SDLFragment): void {
  if (fragment.name.trim().length === 0) {
    throw new GraphQLSchemaError(fragment.name, 'fragment name must not be empty');
  }
  if (fragment.sdl.trim().length === 0) {
    throw new GraphQLSchemaError(fragment.name, 'SDL must not be empty');
  }
}

// ---------------------------------------------------------------------------
// SchemaRegistry
// ---------------------------------------------------------------------------

/**
 * Collects SDL fragments from multiple sources and combines them into a
 * single schema document.
 *
 * Follows a schema-first workflow: each domain registers its own SDL slice,
 * and the registry stitches them together on demand.
 *
 * @example
 * ```ts
 * const registry = new SchemaRegistry();
 * registry.register({ name: 'User', sdl: 'type User { id: ID! name: String! }' });
 * registry.register({ name: 'Query', sdl: 'type Query { user(id: ID!): User }' });
 * const fullSchema = registry.getFullSchema();
 * ```
 */
export class SchemaRegistry {
  private readonly fragments = new Map<string, SDLFragment>();

  /**
   * Register an SDL fragment.
   *
   * Throws {@link GraphQLFragmentAlreadyRegisteredError} if a fragment with
   * the same name has already been registered.
   * Throws {@link GraphQLSchemaError} for empty names or SDL.
   */
  register(fragment: SDLFragment): void {
    validateFragment(fragment);
    if (this.fragments.has(fragment.name)) {
      throw new GraphQLFragmentAlreadyRegisteredError(fragment.name);
    }
    this.fragments.set(fragment.name, fragment);
  }

  /** Replace an existing fragment (or add if new). Does not throw on duplicates. */
  upsert(fragment: SDLFragment): void {
    validateFragment(fragment);
    this.fragments.set(fragment.name, fragment);
  }

  get(name: string): SDLFragment | undefined {
    return this.fragments.get(name);
  }

  has(name: string): boolean {
    return this.fragments.has(name);
  }

  remove(name: string): void {
    this.fragments.delete(name);
  }

  getAll(): readonly SDLFragment[] {
    return [...this.fragments.values()];
  }

  /**
   * Join all SDL fragments into a single schema document (newline-separated).
   * Order follows insertion order.
   */
  getFullSchema(): string {
    return [...this.fragments.values()].map((f) => f.sdl).join('\n\n');
  }

  clear(): void {
    this.fragments.clear();
  }
}
