/**
 * Structural match for the subset of `@opentelemetry/api` `Span` we use.
 *
 * By depending on this interface instead of the SDK type, consumers can
 * pass a real OTel span without adding `@opentelemetry/api` as a hard
 * dependency of this library.
 */
export interface OtelSpanLike {
  setAttributes(attributes: Record<string, string | number | boolean>): OtelSpanLike;
  recordException(exception: Error): void;
  end(): void;
}

/**
 * Structural match for the subset of `@opentelemetry/api` `Tracer` we use.
 */
export interface OtelTracerClientLike {
  startSpan(name: string): OtelSpanLike;
}
