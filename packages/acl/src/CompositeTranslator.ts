import type { Translator } from './types.js';

/**
 * Chains two translators together: `first` converts TSource → TIntermediate,
 * then `second` converts TIntermediate → TTarget.
 *
 * Useful for building multi-step translation pipelines without manual wiring.
 *
 * @example
 * const toDto = new CompositeTranslator(legacyToModel, modelToDto);
 */
export class CompositeTranslator<TSource, TIntermediate, TTarget> implements Translator<
  TSource,
  TTarget
> {
  constructor(
    private readonly first: Translator<TSource, TIntermediate>,
    private readonly second: Translator<TIntermediate, TTarget>,
  ) {}

  translate(source: TSource): TTarget {
    return this.second.translate(this.first.translate(source));
  }
}
