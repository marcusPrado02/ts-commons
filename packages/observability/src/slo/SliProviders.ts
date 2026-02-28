import type { SliProvider, SliResult } from './types';

/**
 * Availability SLI: measures the percentage of successful requests.
 * Consumers provide the total and successful request counts.
 */
export class AvailabilitySli implements SliProvider {
  readonly name = 'availability';

  constructor(
    private readonly getTotal: () => Promise<number>,
    private readonly getSuccessful: () => Promise<number>,
  ) {}

  async measure(): Promise<number> {
    const [total, successful] = await Promise.all([this.getTotal(), this.getSuccessful()]);
    if (total === 0) return 100;
    return (successful / total) * 100;
  }
}

/**
 * Latency SLI: measures the percentage of requests below a latency threshold.
 */
export class LatencySli implements SliProvider {
  readonly name: string;

  constructor(
    private readonly thresholdMs: number,
    private readonly getPercentileMs: () => Promise<number>,
    name?: string,
  ) {
    this.name = name ?? `latency_p99_${thresholdMs}ms`;
  }

  async measure(): Promise<number> {
    const p99 = await this.getPercentileMs();
    return p99 <= this.thresholdMs ? 100 : 0;
  }
}

/**
 * Error rate SLI: measures 1 - error_rate as a percentage.
 */
export class ErrorRateSli implements SliProvider {
  readonly name = 'error_rate';

  constructor(
    private readonly getErrorCount: () => Promise<number>,
    private readonly getTotalCount: () => Promise<number>,
  ) {}

  async measure(): Promise<number> {
    const [errors, total] = await Promise.all([this.getErrorCount(), this.getTotalCount()]);
    if (total === 0) return 100;
    return (1 - errors / total) * 100;
  }
}

/**
 * Simple SLI from a snapshot history.
 */
export class SliTracker {
  private readonly history: SliResult[] = [];
  private readonly maxEntries: number;

  constructor(
    private readonly provider: SliProvider,
    maxEntries = 1000,
  ) {
    this.maxEntries = maxEntries;
  }

  async collect(): Promise<SliResult> {
    const value = await this.provider.measure();
    const result: SliResult = { name: this.provider.name, value, timestamp: new Date() };
    if (this.history.length >= this.maxEntries) this.history.shift();
    this.history.push(result);
    return result;
  }

  getHistory(since?: Date): SliResult[] {
    if (since == null) return [...this.history];
    return this.history.filter((r) => r.timestamp >= since);
  }

  get latest(): SliResult | undefined {
    return this.history.length > 0 ? this.history[this.history.length - 1] : undefined;
  }
}
