import { randomUUID } from 'node:crypto';
import type {
  CriticalPathSegment,
  SamplingConfig,
  ServiceDependency,
  SpanData,
  TraceAlert,
  TraceContext,
} from './types';

/**
 * Advanced distributed tracing manager.
 *
 * Provides sampling, context propagation, dependency mapping,
 * critical path analysis, and trace-based alerting.
 */
export class AdvancedTracer {
  private samplingConfig: SamplingConfig;
  private readonly spans = new Map<string, SpanData[]>(); // traceId → spans
  private readonly alertHandlers: Array<(alert: TraceAlert) => void> = [];
  private readonly alertConditions: Array<{
    name: string;
    check: (span: SpanData) => string | null;
  }> = [];
  private rateLimitCounter = 0;
  private rateLimitWindowStart = Date.now();

  constructor(samplingConfig: SamplingConfig = { strategy: 'always' }) {
    this.samplingConfig = samplingConfig;
  }

  /** Decide whether to sample a new trace. */
  shouldSample(): boolean {
    return this.applySampling();
  }

  /** Create a new root TraceContext. */
  createContext(sampled?: boolean): TraceContext {
    return {
      traceId: randomUUID(),
      spanId: randomUUID(),
      sampled: sampled ?? this.applySampling(),
    };
  }

  /** Create a child span context propagating the existing trace. */
  childContext(parent: TraceContext): TraceContext {
    return {
      traceId: parent.traceId,
      spanId: randomUUID(),
      parentSpanId: parent.spanId,
      sampled: parent.sampled,
      baggage: parent.baggage != null ? { ...parent.baggage } : undefined,
    };
  }

  /** Inject trace context into carrier headers (W3C Trace Context). */
  inject(ctx: TraceContext, headers: Record<string, string>): void {
    headers['traceparent'] =
      `00-${ctx.traceId.replace(/-/g, '')}-${ctx.spanId.replace(/-/g, '')}-${ctx.sampled ? '01' : '00'}`;
    if (ctx.baggage != null && Object.keys(ctx.baggage).length > 0) {
      headers['baggage'] = Object.entries(ctx.baggage)
        .map(([k, v]) => `${k}=${v}`)
        .join(',');
    }
  }

  /** Extract trace context from carrier headers. */
  extract(headers: Record<string, string>): TraceContext | null {
    const tp = headers['traceparent'];
    if (tp == null) return null;
    const parts = tp.split('-');
    if (parts.length < 4) return null;
    const [, rawTraceId, rawSpanId, flags] = parts;
    return {
      traceId: formatUuid(rawTraceId),
      spanId: formatUuid(rawSpanId),
      sampled: flags === '01',
    };
  }

  /** Record a completed span. */
  recordSpan(span: SpanData): void {
    const existing = this.spans.get(span.traceId) ?? [];
    existing.push(span);
    this.spans.set(span.traceId, existing);
    this.checkAlerts(span);
  }

  /** Get all spans for a trace. */
  getTrace(traceId: string): SpanData[] {
    return this.spans.get(traceId) ?? [];
  }

  /** Build a service dependency map from recorded spans. */
  getServiceDependencies(): ServiceDependency[] {
    const depMap = new Map<string, ServiceDependency>();
    for (const spans of this.spans.values()) {
      for (const span of spans) {
        const fromService = span.attributes['service.name'];
        const toService = span.attributes['peer.service'];
        if (typeof fromService !== 'string' || typeof toService !== 'string') continue;
        const key = `${fromService}→${toService}`;
        const existing = depMap.get(key);
        if (existing != null) {
          existing.callCount++;
          if (span.status === 'error') existing.errorCount++;
          existing.avgDurationMs =
            (existing.avgDurationMs * (existing.callCount - 1) + span.durationMs) /
            existing.callCount;
        } else {
          depMap.set(key, {
            from: fromService,
            to: toService,
            callCount: 1,
            errorCount: span.status === 'error' ? 1 : 0,
            avgDurationMs: span.durationMs,
          });
        }
      }
    }
    return Array.from(depMap.values());
  }

  /** Identify the critical path (slowest chain) in a trace. */
  getCriticalPath(traceId: string): CriticalPathSegment[] {
    const spans = this.spans.get(traceId) ?? [];
    if (spans.length === 0) return [];
    const totalDuration = spans.reduce((sum, s) => sum + s.durationMs, 0);
    return spans
      .sort((a, b) => b.durationMs - a.durationMs)
      .map((s) => ({
        spanId: s.spanId,
        name: s.name,
        durationMs: s.durationMs,
        percentage: totalDuration > 0 ? (s.durationMs / totalDuration) * 100 : 0,
      }));
  }

  /** Register an alert condition. Handler called when matched. */
  addAlertCondition(name: string, check: (span: SpanData) => string | null): void {
    this.alertConditions.push({ name, check });
  }

  onAlert(handler: (alert: TraceAlert) => void): () => void {
    this.alertHandlers.push(handler);
    return () => {
      const idx = this.alertHandlers.indexOf(handler);
      if (idx !== -1) this.alertHandlers.splice(idx, 1);
    };
  }

  updateSampling(config: SamplingConfig): void {
    this.samplingConfig = config;
  }

  private applySampling(): boolean {
    const { strategy } = this.samplingConfig;
    if (strategy === 'always') return true;
    if (strategy === 'never') return false;
    if (strategy === 'probabilistic') {
      return Math.random() < (this.samplingConfig.probability ?? 0.5);
    }
    // 'rate-limited'
    return this.checkRateLimit();
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    if (now - this.rateLimitWindowStart >= 1000) {
      this.rateLimitCounter = 0;
      this.rateLimitWindowStart = now;
    }
    const max = this.samplingConfig.maxPerSecond ?? 100;
    if (this.rateLimitCounter < max) {
      this.rateLimitCounter++;
      return true;
    }
    return false;
  }

  private checkAlerts(span: SpanData): void {
    for (const condition of this.alertConditions) {
      const message = condition.check(span);
      if (message != null) {
        const alert: TraceAlert = {
          traceId: span.traceId,
          spanId: span.spanId,
          condition: condition.name,
          message,
          triggeredAt: new Date(),
        };
        for (const h of this.alertHandlers) h(alert);
      }
    }
  }
}

function formatUuid(hex: string): string {
  // 32 hex chars → 8-4-4-4-12
  if (hex.length !== 32) return hex;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
