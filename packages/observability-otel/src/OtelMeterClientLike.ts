/**
 * Structural match for the subset of `@opentelemetry/api` `Counter` we use.
 */
export interface OtelCounterLike {
  add(value: number, attributes?: Record<string, string>): void;
}

/**
 * Structural match for the subset of `@opentelemetry/api` `Histogram` we use.
 */
export interface OtelHistogramLike {
  record(value: number, attributes?: Record<string, string>): void;
}

/**
 * Structural match for the subset of `@opentelemetry/api` `Meter` we use.
 */
export interface OtelMeterClientLike {
  createCounter(name: string): OtelCounterLike;
  createHistogram(name: string): OtelHistogramLike;
}
