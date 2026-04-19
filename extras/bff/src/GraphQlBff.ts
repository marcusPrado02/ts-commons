import type { GraphQlField, GraphQlResult, GraphQlFieldError } from './types.js';

/**
 * GraphQL-style BFF aggregator.
 *
 * Fields are registered once via {@link GraphQlBff.addField}; they are then
 * resolved concurrently by {@link GraphQlBff.execute}.  Per-field errors are
 * captured in `result.errors` rather than propagating as a rejection — the
 * same partial-failure contract GraphQL resolvers follow.
 *
 * @example
 * const gql = new GraphQlBff()
 *   .addField({ name: 'user',    resolve: () => getUser(id) })
 *   .addField({ name: 'orders',  resolve: () => getOrders(id) });
 *
 * const result = await gql.execute(['user', 'orders']);
 */
export class GraphQlBff {
  private readonly fields = new Map<string, GraphQlField>();

  /**
   * Register a field resolver.
   * If a field with the same name already exists it is replaced.
   * Returns `this` for a fluent API.
   */
  addField(field: GraphQlField): this {
    this.fields.set(field.name, field);
    return this;
  }

  /**
   * Resolve the requested fields concurrently.
   *
   * @param fieldNames  The subset of fields to resolve.  When omitted, all
   *                    registered fields are resolved.
   */
  async execute(fieldNames?: readonly string[]): Promise<GraphQlResult> {
    const names = fieldNames ?? [...this.fields.keys()];

    const settled = await Promise.allSettled(
      names.map(async (name) => {
        const field = this.fields.get(name);
        if (field === undefined) {
          throw new Error(`Field "${name}" is not registered`);
        }
        const value = await field.resolve();
        return { name, value };
      }),
    );

    const data: Record<string, unknown> = {};
    const errors: GraphQlFieldError[] = [];

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        data[result.value.name] = result.value.value;
      } else {
        const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
        // Extract field name from the error or fall back to 'unknown'
        const fieldName =
          result.reason instanceof Error && result.reason.message.startsWith('Field "')
            ? result.reason.message.slice(7, result.reason.message.indexOf('"', 7))
            : 'unknown';
        errors.push({ field: fieldName, message: msg });
      }
    }

    return { data, errors };
  }

  /** Returns `true` if a field resolver is registered under `name`. */
  hasField(name: string): boolean {
    return this.fields.has(name);
  }

  /** Number of registered field resolvers. */
  fieldCount(): number {
    return this.fields.size;
  }
}
