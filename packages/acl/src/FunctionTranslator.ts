import type { Translator } from './types.js';

/**
 * Wraps a plain function as a {@link Translator}.
 *
 * @example
 * const upper = new FunctionTranslator<string, string>((s) => s.toUpperCase());
 */
export class FunctionTranslator<TSource, TTarget> implements Translator<TSource, TTarget> {
  constructor(private readonly fn: (source: TSource) => TTarget) {}

  translate(source: TSource): TTarget {
    return this.fn(source);
  }
}
