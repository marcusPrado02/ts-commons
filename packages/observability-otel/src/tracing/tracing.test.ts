/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from 'vitest';
import { AdvancedTracer } from './AdvancedTracer';
import type { SpanData } from './types';

function makeSpan(overrides: Partial<SpanData> = {}): SpanData {
  return {
    traceId: 'trace-001',
    spanId: 'span-001',
    name: 'GET /api/user',
    startTime: Date.now() - 100,
    endTime: Date.now(),
    durationMs: 100,
    attributes: {},
    status: 'ok',
    events: [],
    ...overrides,
  };
}

describe('AdvancedTracer - sampling', () => {
  it('always strategy always samples', () => {
    const tracer = new AdvancedTracer({ strategy: 'always' });
    expect(tracer.shouldSample()).toBe(true);
  });

  it('never strategy never samples', () => {
    const tracer = new AdvancedTracer({ strategy: 'never' });
    expect(tracer.shouldSample()).toBe(false);
  });

  it('probabilistic at 1.0 always samples', () => {
    const tracer = new AdvancedTracer({ strategy: 'probabilistic', probability: 1 });
    expect(tracer.shouldSample()).toBe(true);
  });

  it('probabilistic at 0.0 never samples', () => {
    const tracer = new AdvancedTracer({ strategy: 'probabilistic', probability: 0 });
    expect(tracer.shouldSample()).toBe(false);
  });

  it('rate-limited allows up to maxPerSecond', () => {
    const tracer = new AdvancedTracer({ strategy: 'rate-limited', maxPerSecond: 2 });
    expect(tracer.shouldSample()).toBe(true); // 1
    expect(tracer.shouldSample()).toBe(true); // 2
    expect(tracer.shouldSample()).toBe(false); // 3 — exceeds
  });

  it('updateSampling changes strategy', () => {
    const tracer = new AdvancedTracer({ strategy: 'always' });
    tracer.updateSampling({ strategy: 'never' });
    expect(tracer.shouldSample()).toBe(false);
  });
});

describe('AdvancedTracer - context propagation', () => {
  it('createContext returns a root context', () => {
    const tracer = new AdvancedTracer();
    const ctx = tracer.createContext(true);
    expect(ctx.traceId).toBeDefined();
    expect(ctx.spanId).toBeDefined();
    expect(ctx.parentSpanId).toBeUndefined();
    expect(ctx.sampled).toBe(true);
  });

  it('childContext inherits traceId', () => {
    const tracer = new AdvancedTracer();
    const root = tracer.createContext(true);
    const child = tracer.childContext(root);
    expect(child.traceId).toBe(root.traceId);
    expect(child.parentSpanId).toBe(root.spanId);
    expect(child.spanId).not.toBe(root.spanId);
  });

  it('inject and extract round-trip', () => {
    const tracer = new AdvancedTracer();
    const ctx = tracer.createContext(true);
    const headers: Record<string, string> = {};
    tracer.inject(ctx, headers);
    expect(headers['traceparent']).toBeDefined();
    const extracted = tracer.extract(headers);
    expect(extracted).not.toBeNull();
    expect(extracted?.sampled).toBe(true);
  });

  it('extract returns null for missing traceparent', () => {
    const tracer = new AdvancedTracer();
    expect(tracer.extract({})).toBeNull();
  });
});

describe('AdvancedTracer - spans and analysis', () => {
  it('recordSpan and getTrace', () => {
    const tracer = new AdvancedTracer();
    tracer.recordSpan(makeSpan());
    expect(tracer.getTrace('trace-001').length).toBe(1);
  });

  it('getTrace returns empty for unknown traceId', () => {
    const tracer = new AdvancedTracer();
    expect(tracer.getTrace('unknown')).toEqual([]);
  });

  it('getServiceDependencies maps service calls', () => {
    const tracer = new AdvancedTracer();
    tracer.recordSpan(
      makeSpan({
        attributes: { 'service.name': 'api', 'peer.service': 'db' },
        durationMs: 50,
      }),
    );
    tracer.recordSpan(
      makeSpan({
        spanId: 'span-002',
        attributes: { 'service.name': 'api', 'peer.service': 'db' },
        durationMs: 100,
      }),
    );
    const deps = tracer.getServiceDependencies();
    expect(deps.length).toBe(1);
    expect(deps[0].from).toBe('api');
    expect(deps[0].to).toBe('db');
    expect(deps[0].callCount).toBe(2);
  });

  it('getCriticalPath sorts by duration descending', () => {
    const tracer = new AdvancedTracer();
    tracer.recordSpan(makeSpan({ spanId: 's1', durationMs: 10 }));
    tracer.recordSpan(makeSpan({ spanId: 's2', durationMs: 90 }));
    const path = tracer.getCriticalPath('trace-001');
    expect(path[0].spanId).toBe('s2');
    expect(path[0].durationMs).toBe(90);
  });

  it('trace-based alert fires on condition match', () => {
    const tracer = new AdvancedTracer();
    const handler = vi.fn();
    tracer.onAlert(handler);
    tracer.addAlertCondition('slow-span', (span) =>
      span.durationMs > 500 ? `Span ${span.name} took ${span.durationMs}ms` : null,
    );
    tracer.recordSpan(makeSpan({ durationMs: 1000 }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('alert handler not called when condition unmet', () => {
    const tracer = new AdvancedTracer();
    const handler = vi.fn();
    tracer.onAlert(handler);
    tracer.addAlertCondition('slow-span', (span) => (span.durationMs > 500 ? 'slow' : null));
    tracer.recordSpan(makeSpan({ durationMs: 100 }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('onAlert unsubscribe stops alerts', () => {
    const tracer = new AdvancedTracer();
    const handler = vi.fn();
    const unsub = tracer.onAlert(handler);
    tracer.addAlertCondition('any', () => 'trigger');
    unsub();
    tracer.recordSpan(makeSpan());
    expect(handler).not.toHaveBeenCalled();
  });
});
