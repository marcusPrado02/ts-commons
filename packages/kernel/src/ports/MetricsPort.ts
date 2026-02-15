/**
 * Port for metrics collection.
 * Implementations provide actual metrics infrastructure.
 */
export interface MetricsPort {
  incrementCounter(name: string, value?: number, labels?: Record<string, string>): void;
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void;
  setGauge(name: string, value: number, labels?: Record<string, string>): void;
}
