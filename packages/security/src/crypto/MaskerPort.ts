/**
 * Options for masking a string value.
 */
export interface MaskOptions {
  /** Number of characters to leave visible at the start. Defaults to 0. */
  readonly visiblePrefix?: number;
  /** Number of characters to leave visible at the end. Defaults to 0. */
  readonly visibleSuffix?: number;
  /** Character to use for masking. Defaults to `'*'`. */
  readonly maskChar?: string;
}

/**
 * Port for masking / redacting sensitive (PII) values.
 *
 * @example
 * ```typescript
 * const masker = new PiiMasker();
 * masker.mask('user@example.com', { visibleSuffix: 11 }); // '****@example.com'
 * masker.mask('4111111111111111', { visibleSuffix: 4 });   // '************1111'
 * ```
 */
export interface MaskerPort {
  mask(value: string, options?: MaskOptions): string;
}
