import type { SpanHandle, SpanAttributes, TracerPort } from './TracerPort';
import type { OtelSpanLike, OtelTracerClientLike } from './OtelTracerClientLike';

function buildSpanHandle(span: OtelSpanLike): SpanHandle {
  return {
    setAttributes(attrs: SpanAttributes): void {
      span.setAttributes({ ...attrs });
    },
    recordError(error: Error): void {
      span.recordException(error);
    },
    end(): void {
      span.end();
    },
  };
}

/**
 * OpenTelemetry-backed tracer adapter.
 *
 * Delegates to any object that structurally matches `OtelTracerClientLike` —
 * typically the tracer obtained from `opentelemetry.trace.getTracer(name)`.
 *
 * @example
 * ```typescript
 * import { trace } from '@opentelemetry/api';
 * import { OtelTracer } from '@acme/observability-otel';
 *
 * const tracer  = new OtelTracer(trace.getTracer('my-service'));
 * const span    = tracer.startSpan('processOrder', { 'order.id': orderId });
 * try { ... } finally { span.end(); }
 * ```
 */
export class OtelTracer implements TracerPort {
  constructor(private readonly tracer: OtelTracerClientLike) {}

  startSpan(name: string, attributes?: SpanAttributes): SpanHandle {
    const span = this.tracer.startSpan(name);
    if (attributes !== undefined) {
      span.setAttributes({ ...attributes });
    }
    return buildSpanHandle(span);
  }
}
