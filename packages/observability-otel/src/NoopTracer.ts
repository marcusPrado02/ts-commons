import type { SpanHandle, SpanAttributes, TracerPort } from './TracerPort';

/** A `SpanHandle` that performs no operations. */
const NOOP_SPAN_HANDLE: SpanHandle = {
  setAttributes(_attributes: SpanAttributes): void { /* noop */ },
  recordError(_error: Error): void { /* noop */ },
  end(): void { /* noop */ },
};

/**
 * No-op tracer — silently discards all spans.
 *
 * Use in tests or when tracing is intentionally disabled so that code wired
 * to `TracerPort` keeps working without configuration.
 *
 * @example
 * ```typescript
 * const tracer: TracerPort = isTracingEnabled
 *   ? new OtelTracer(otelTracer)
 *   : new NoopTracer();
 * ```
 */
export class NoopTracer implements TracerPort {
  startSpan(_name: string, _attributes?: SpanAttributes): SpanHandle {
    return NOOP_SPAN_HANDLE;
  }
}
