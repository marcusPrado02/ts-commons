import type { DataConverter } from './types.js';

/**
 * Registry that maps `fromFormat:toFormat` composite keys to
 * {@link DataConverter} instances.
 *
 * Enables format-agnostic data conversion: callers look up a converter by
 * the names of the source and target formats rather than by coupled types.
 */
export class DataFormatRegistry {
  private readonly map = new Map<string, DataConverter<unknown, unknown>>();

  private static key(fromFormat: string, toFormat: string): string {
    return `${fromFormat}:${toFormat}`;
  }

  /**
   * Register a converter.  The composite key is derived from
   * `converter.fromFormat` and `converter.toFormat`.
   * Returns `this` for a fluent API.
   */
  register<TFrom, TTo>(converter: DataConverter<TFrom, TTo>): this {
    const k = DataFormatRegistry.key(converter.fromFormat, converter.toFormat);
    this.map.set(k, converter as DataConverter<unknown, unknown>);
    return this;
  }

  /**
   * Convert `data` from `fromFormat` to `toFormat`.
   * @throws {Error} when no converter is registered for the format pair.
   */
  convert<TFrom, TTo>(fromFormat: string, toFormat: string, data: TFrom): TTo {
    const k = DataFormatRegistry.key(fromFormat, toFormat);
    const converter = this.map.get(k);
    if (converter === undefined) {
      throw new Error(`No converter registered for "${fromFormat}" → "${toFormat}"`);
    }
    return converter.convert(data) as TTo;
  }

  /** Returns `true` if a converter exists for the given format pair. */
  has(fromFormat: string, toFormat: string): boolean {
    return this.map.has(DataFormatRegistry.key(fromFormat, toFormat));
  }

  /** Number of registered converters. */
  size(): number {
    return this.map.size;
  }
}
