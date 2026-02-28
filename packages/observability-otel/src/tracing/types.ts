/**
 * Advanced distributed tracing types.
 */

export type SamplingStrategy = 'always' | 'never' | 'probabilistic' | 'rate-limited';

export interface SamplingConfig {
  strategy: SamplingStrategy;
  /** For probabilistic: 0–1 probability of sampling */
  probability?: number;
  /** For rate-limited: max traces per second */
  maxPerSecond?: number;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sampled: boolean;
  baggage?: Record<string, string>;
}

export interface SpanData {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  attributes: Record<string, string | number | boolean>;
  status: 'ok' | 'error' | 'unset';
  events: SpanEvent[];
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, string | number | boolean>;
}

export interface ServiceDependency {
  from: string;
  to: string;
  callCount: number;
  errorCount: number;
  avgDurationMs: number;
}

export interface CriticalPathSegment {
  spanId: string;
  name: string;
  durationMs: number;
  percentage: number;
}

export interface TraceAlert {
  traceId: string;
  spanId: string;
  condition: string;
  message: string;
  triggeredAt: Date;
}
