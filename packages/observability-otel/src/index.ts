// Ports
export type { SpanHandle, SpanAttributes, TracerPort } from './TracerPort';
export type { MetricLabels, MetricsPort } from './MetricsPort';

// Structural interfaces (no @opentelemetry/api import required)
export type { OtelSpanLike, OtelTracerClientLike } from './OtelTracerClientLike';
export type {
  OtelCounterLike,
  OtelHistogramLike,
  OtelMeterClientLike,
} from './OtelMeterClientLike';

// Adapters
export { OtelTracer } from './OtelTracer';
export { OtelMetrics } from './OtelMetrics';
export { NoopTracer } from './NoopTracer';
export { NoopMetrics } from './NoopMetrics';
export { AdvancedTracer } from './tracing/AdvancedTracer';
export type {
  SamplingStrategy,
  SamplingConfig,
  TraceContext,
  SpanData,
  SpanEvent,
  ServiceDependency,
  CriticalPathSegment,
  TraceAlert,
} from './tracing/types';
