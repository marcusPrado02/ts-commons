import type { MaskerPort, MaskOptions } from './MaskerPort';

/**
 * General-purpose PII value masker.
 *
 * Replaces the middle portion of a string with a mask character, leaving an
 * optional prefix and/or suffix visible.  Works with emails, phone numbers,
 * credit card numbers, national IDs, etc.
 *
 * @example
 * ```typescript
 * const masker = new PiiMasker();
 *
 * masker.mask('user@example.com', { visibleSuffix: 11 });
 * // → '****@example.com'
 *
 * masker.mask('4111111111111111', { visibleSuffix: 4 });
 * // → '************1111'
 *
 * masker.mask('+1-800-555-0100', { visiblePrefix: 3, visibleSuffix: 4 });
 * // → '+1-*******0100'
 * ```
 */
export class PiiMasker implements MaskerPort {
  mask(value: string, options?: MaskOptions): string {
    const visiblePrefix = options?.visiblePrefix ?? 0;
    const visibleSuffix = options?.visibleSuffix ?? 0;
    const maskChar      = options?.maskChar ?? '*';

    const len  = value.length;
    const keep = visiblePrefix + visibleSuffix;
    if (keep >= len) return value;

    const prefix = value.slice(0, visiblePrefix);
    const suffix = visibleSuffix > 0 ? value.slice(len - visibleSuffix) : '';
    const masked = maskChar.repeat(len - keep);

    return prefix + masked + suffix;
  }
}
