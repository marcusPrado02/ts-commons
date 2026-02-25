import type { TranslationResult } from './types.js';

/**
 * Creates a {@link TranslationResult} with the given value and optional warnings.
 *
 * @param value     The translated value.
 * @param warnings  Non-fatal messages generated during translation.
 */
export function createTranslationResult<T>(
  value: T,
  warnings: readonly string[] = [],
): TranslationResult<T> {
  return {
    value,
    translatedAt: new Date(),
    warnings,
  };
}
