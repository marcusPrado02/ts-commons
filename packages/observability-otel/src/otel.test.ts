/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Vitest mock objects */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- Vitest mock arguments */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- Vitest mock property access */
/* eslint-disable @typescript-eslint/no-unsafe-call -- Vitest mock call patterns */
/* eslint-disable @typescript-eslint/no-unsafe-return -- Vitest mock return values */
/* eslint-disable @typescript-eslint/unbound-method -- Vitest mocking pattern requires unbound methods */
/* eslint-disable @typescript-eslint/explicit-function-return-type -- test helper functions */
/* eslint-disable max-lines-per-function -- test files naturally have longer functions */
/**
 * Tests for @acme/observability-otel — OtelTracer, OtelMetrics, NoopTracer, NoopMetrics
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OtelTracer } from './OtelTracer';
import { OtelMetrics } from './OtelMetrics';
import { NoopTracer } from './NoopTracer';
import { NoopMetrics } from './NoopMetrics';
import type { OtelTracerClientLike } from './OtelTracerClientLike';
import type { OtelMeterClientLike } from './OtelMeterClientLike';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMockSpan() {
  return {
    setAttributes: vi.fn().mockReturnThis(),
    recordException: vi.fn(),
    end: vi.fn(),
  };
}

function buildMockCounter() {
  return { add: vi.fn() };
}

function buildMockHistogram() {
  return { record: vi.fn() };
}

// ---------------------------------------------------------------------------
// OtelTracer
// ---------------------------------------------------------------------------

describe('OtelTracer', () => {
  let mockSpan: ReturnType<typeof buildMockSpan>;
  let mockTracerClient: OtelTracerClientLike;
  let tracer: OtelTracer;

  beforeEach(() => {
    mockSpan          = buildMockSpan();
    mockTracerClient  = { startSpan: vi.fn().mockReturnValue(mockSpan) } as unknown as OtelTracerClientLike;
    tracer            = new OtelTracer(mockTracerClient);
  });

  it('startSpan calls tracer.startSpan with the correct name', () => {
    tracer.startSpan('processOrder');

    expect(mockTracerClient.startSpan).toHaveBeenCalledWith('processOrder');
  });

  it('startSpan with attributes calls span.setAttributes once', () => {
    tracer.startSpan('doWork', { 'job.id': 'j-1', retries: 3 });

    expect(mockSpan.setAttributes).toHaveBeenCalledOnce();
    expect(mockSpan.setAttributes).toHaveBeenCalledWith({ 'job.id': 'j-1', retries: 3 });
  });

  it('startSpan without attributes does not call span.setAttributes', () => {
    tracer.startSpan('doWork');

    expect(mockSpan.setAttributes).not.toHaveBeenCalled();
  });

  it('SpanHandle.end delegates to span.end', () => {
    const span = tracer.startSpan('fetchUser');

    span.end();

    expect(mockSpan.end).toHaveBeenCalledOnce();
  });

  it('SpanHandle.recordError delegates to span.recordException', () => {
    const span  = tracer.startSpan('action');
    const error = new Error('boom');

    span.recordError(error);

    expect(mockSpan.recordException).toHaveBeenCalledWith(error);
  });
});

// ---------------------------------------------------------------------------
// OtelMetrics
// ---------------------------------------------------------------------------

describe('OtelMetrics', () => {
  let mockCounter:   ReturnType<typeof buildMockCounter>;
  let mockHistogram: ReturnType<typeof buildMockHistogram>;
  let mockMeter:     OtelMeterClientLike;
  let metrics:       OtelMetrics;

  beforeEach(() => {
    mockCounter   = buildMockCounter();
    mockHistogram = buildMockHistogram();
    mockMeter     = {
      createCounter:   vi.fn().mockReturnValue(mockCounter),
      createHistogram: vi.fn().mockReturnValue(mockHistogram),
    } as unknown as OtelMeterClientLike;
    metrics = new OtelMetrics(mockMeter);
  });

  it('incrementCounter calls meter.createCounter with the given name', () => {
    metrics.incrementCounter('http.requests', 1);

    expect(mockMeter.createCounter).toHaveBeenCalledWith('http.requests');
  });

  it('incrementCounter calls counter.add(value) when no labels provided', () => {
    metrics.incrementCounter('events', 5);

    expect(mockCounter.add).toHaveBeenCalledWith(5);
  });

  it('incrementCounter passes labels to counter.add when labels provided', () => {
    metrics.incrementCounter('http.requests', 1, { method: 'GET', status: '200' });

    expect(mockCounter.add).toHaveBeenCalledWith(1, { method: 'GET', status: '200' });
  });

  it('createCounter is called only once for the same counter name (caching)', () => {
    metrics.incrementCounter('req', 1);
    metrics.incrementCounter('req', 2);
    metrics.incrementCounter('req', 3);

    expect(mockMeter.createCounter).toHaveBeenCalledOnce();
    expect(mockCounter.add).toHaveBeenCalledTimes(3);
  });

  it('recordHistogram calls createHistogram and histogram.record with value and labels', () => {
    metrics.recordHistogram('http.duration_ms', 42, { route: '/users' });

    expect(mockMeter.createHistogram).toHaveBeenCalledWith('http.duration_ms');
    expect(mockHistogram.record).toHaveBeenCalledWith(42, { route: '/users' });
  });
});

// ---------------------------------------------------------------------------
// NoopTracer
// ---------------------------------------------------------------------------

describe('NoopTracer', () => {
  const tracer = new NoopTracer();

  it('startSpan returns a SpanHandle without throwing', () => {
    expect(() => tracer.startSpan('anything')).not.toThrow();
  });

  it('SpanHandle.end can be called without throwing', () => {
    const span = tracer.startSpan('op');

    expect(() => span.end()).not.toThrow();
  });

  it('SpanHandle.setAttributes can be called without throwing', () => {
    const span = tracer.startSpan('op');

    expect(() => span.setAttributes({ key: 'value', count: 1 })).not.toThrow();
  });

  it('SpanHandle.recordError can be called without throwing', () => {
    const span = tracer.startSpan('op');

    expect(() => span.recordError(new Error('ignored'))).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// NoopMetrics
// ---------------------------------------------------------------------------

describe('NoopMetrics', () => {
  const metrics = new NoopMetrics();

  it('incrementCounter does not throw without labels', () => {
    expect(() => metrics.incrementCounter('requests', 1)).not.toThrow();
  });

  it('recordHistogram does not throw without labels', () => {
    expect(() => metrics.recordHistogram('latency_ms', 123)).not.toThrow();
  });

  it('incrementCounter does not throw with labels', () => {
    expect(() => metrics.incrementCounter('errors', 1, { type: 'timeout' })).not.toThrow();
  });

  it('recordHistogram does not throw with labels', () => {
    expect(() => metrics.recordHistogram('payload_bytes', 512, { route: '/api' })).not.toThrow();
  });

  it('multiple incrementCounter calls with different names do not throw', () => {
    expect(() => {
      metrics.incrementCounter('a', 1);
      metrics.incrementCounter('b', 2);
      metrics.incrementCounter('c', 3);
    }).not.toThrow();
  });
});
