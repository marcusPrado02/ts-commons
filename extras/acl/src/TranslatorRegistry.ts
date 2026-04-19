import type { Translator } from './types.js';

/**
 * Registry that maps string keys to {@link Translator} instances.
 *
 * Concrete translator types are erased to `Translator<unknown, unknown>` at
 * storage time and restored via a type-assertion on retrieval — generic
 * safety is the caller's responsibility.
 */
export class TranslatorRegistry {
  private readonly map = new Map<string, Translator<unknown, unknown>>();

  /**
   * Register a translator under a given key.
   * Returns `this` for a fluent API.
   */
  register<TSource, TTarget>(key: string, translator: Translator<TSource, TTarget>): this {
    this.map.set(key, translator as Translator<unknown, unknown>);
    return this;
  }

  /**
   * Translate a value using the translator registered under `key`.
   * @throws {Error} when no translator is registered for `key`.
   */
  translate<TSource, TTarget>(key: string, source: TSource): TTarget {
    const translator = this.map.get(key);
    if (translator === undefined) {
      throw new Error(`No translator registered for key: "${key}"`);
    }
    return translator.translate(source) as TTarget;
  }

  /** Returns `true` if a translator is registered under `key`. */
  has(key: string): boolean {
    return this.map.has(key);
  }

  /** Number of registered translators. */
  size(): number {
    return this.map.size;
  }
}
