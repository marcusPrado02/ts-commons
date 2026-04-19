import type { CustomDimension, AnalyticsEvent, EventProperties } from './types.js';

/**
 * Registry for named custom dimensions that can be injected into
 * analytics events based on a context object.
 *
 * @example
 * ```ts
 * const registry = new CustomDimensionRegistry()
 *   .register({ key: 'plan', label: 'Subscription Plan' })
 *   .register({ key: 'region', label: 'User Region' });
 *
 * const enriched = registry.enrich(event, { plan: 'pro', region: 'eu' });
 * ```
 */
export class CustomDimensionRegistry {
  private readonly dimensions: CustomDimension[] = [];

  /** Register a custom dimension — returns `this` for fluent chaining. */
  register(dimension: CustomDimension): this {
    this.dimensions.push(dimension);
    return this;
  }

  /** Number of registered dimensions. */
  count(): number {
    return this.dimensions.length;
  }

  /** Returns all registered dimensions (shallow copy). */
  getAll(): CustomDimension[] {
    return [...this.dimensions];
  }

  /**
   * Enrich an event by merging matching dimension values from `context`
   * into the event's `properties`.
   *
   * Only dimensions whose `key` is present in `context` are added.
   *
   * @returns A new {@link AnalyticsEvent} with the enriched properties.
   */
  enrich(event: AnalyticsEvent, context: EventProperties): AnalyticsEvent {
    const extra: EventProperties = {};
    for (const dim of this.dimensions) {
      if (Object.prototype.hasOwnProperty.call(context, dim.key)) {
        extra[dim.key] = context[dim.key];
      }
    }

    return {
      ...event,
      properties: { ...event.properties, ...extra },
    };
  }

  /**
   * Find a registered dimension by key.
   * @returns The dimension, or `undefined` if not found.
   */
  find(key: string): CustomDimension | undefined {
    return this.dimensions.find((d) => d.key === key);
  }
}
