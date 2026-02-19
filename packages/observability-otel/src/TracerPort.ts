/**
 * Attribute types that can be attached to a span.
 */
export type SpanAttributes = Readonly<Record<string, string | number | boolean>>;

/**
 * Handle to a running (or ended) span.
 * Returned by `TracerPort.startSpan`; the caller is responsible for calling `end()`.
 */
export interface SpanHandle {
  /** Attach or overwrite attributes on the running span. */
  setAttributes(attributes: SpanAttributes): void;
  /** Record an error / exception on the span. */
  recordError(error: Error): void;
  /** Finalise the span and submit it to the exporter. */
  end(): void;
}

/**
 * Port for distributed tracing.
 *
 * Implementations wrap real tracing back-ends (OpenTelemetry, Datadog, etc.)
 * or provide a no-op suitable for tests.
 *
 * @example
 * ```typescript
 * const span = tracer.startSpan('processOrder', { 'order.id': orderId });
 * try { ... } finally { span.end(); }
 * ```
 */
export interface TracerPort {
  startSpan(name: string, attributes?: SpanAttributes): SpanHandle;
}
