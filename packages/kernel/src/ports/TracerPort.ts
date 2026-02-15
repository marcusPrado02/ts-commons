/**
 * Port for distributed tracing.
 * Implementations provide actual tracing infrastructure (e.g., OpenTelemetry).
 */
export interface TracerPort {
  startSpan(name: string, attributes?: Record<string, unknown>): SpanPort;
}

export interface SpanPort {
  setAttribute(key: string, value: unknown): void;
  setAttributes(attributes: Record<string, unknown>): void;
  recordException(error: Error): void;
  end(): void;
}
