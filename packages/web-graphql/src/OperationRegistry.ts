import type { ResolverFn } from './GraphQLTypes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OperationType = 'query' | 'mutation';

export interface OperationRegistration {
  readonly type: OperationType;
  readonly name: string;
  readonly handler: ResolverFn;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Maps operation names to their handler functions.
 *
 * The {@link InMemoryGraphQLAdapter} resolves operations by looking up the
 * `operationName` from the GraphQL request in this registry.
 *
 * @example
 * ```ts
 * const registry = new OperationRegistry();
 * registry.register({ type: 'query', name: 'GetUser', handler: getUserResolver });
 * registry.register({ type: 'mutation', name: 'CreateUser', handler: createUserResolver });
 * ```
 */
export class OperationRegistry {
  private readonly operations = new Map<string, OperationRegistration>();

  register(registration: OperationRegistration): void {
    this.operations.set(registration.name, registration);
  }

  /** Register multiple operations at once. */
  registerAll(registrations: readonly OperationRegistration[]): void {
    for (const reg of registrations) {
      this.register(reg);
    }
  }

  get(name: string): OperationRegistration | undefined {
    return this.operations.get(name);
  }

  has(name: string): boolean {
    return this.operations.has(name);
  }

  unregister(name: string): void {
    this.operations.delete(name);
  }

  getAll(): readonly OperationRegistration[] {
    return [...this.operations.values()];
  }

  /** Return all registered operations of a given type. */
  getByType(type: OperationType): readonly OperationRegistration[] {
    return [...this.operations.values()].filter((op) => op.type === type);
  }

  clear(): void {
    this.operations.clear();
  }
}
