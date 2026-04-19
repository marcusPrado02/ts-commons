/**
 * Core interfaces for the Anti-Corruption Layer.
 */

/**
 * Synchronous translator: converts a value of TSource to TTarget.
 */
export interface Translator<TSource, TTarget> {
  translate(source: TSource): TTarget;
}

/**
 * Asynchronous translator: converts a value of TSource to TTarget via a Promise.
 */
export interface AsyncTranslator<TSource, TTarget> {
  translate(source: TSource): Promise<TTarget>;
}

/**
 * Optional context carried alongside a translation operation.
 */
export interface TranslationContext {
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * The result of a translation that may carry non-fatal warnings.
 */
export interface TranslationResult<T> {
  readonly value: T;
  readonly translatedAt: Date;
  readonly warnings: readonly string[];
}

/**
 * A converter that transforms data from one format to another.
 * The `fromFormat` and `toFormat` strings act as identifiers for the registry.
 */
export interface DataConverter<TFrom, TTo> {
  readonly fromFormat: string;
  readonly toFormat: string;
  canConvert(fromFormat: string, toFormat: string): boolean;
  convert(data: TFrom): TTo;
}

/**
 * Two-way adapter between an external protocol representation and the
 * internal domain representation.
 */
export interface ProtocolAdapter<TExtReq, TIntReq, TIntRes, TExtRes> {
  adaptRequest(external: TExtReq): TIntReq;
  adaptResponse(internal: TIntRes): TExtRes;
}

/**
 * A structured error produced by the Anti-Corruption Layer when a legacy
 * operation fails.
 */
export interface AclError {
  readonly code: string;
  readonly message: string;
  readonly originalError: unknown;
}
