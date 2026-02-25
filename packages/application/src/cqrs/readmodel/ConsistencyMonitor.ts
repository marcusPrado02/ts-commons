import type { ConsistencyReport, ProjectionConsistencyStats } from './types.js';

const DEFAULT_THRESHOLD_MS = 5000;

/**
 * Tracks eventual consistency lag per projection and reports on overall health.
 */
export class ConsistencyMonitor {
  private readonly lags = new Map<string, number[]>();

  recordLag(projectionName: string, lagMs: number): void {
    if (!this.lags.has(projectionName)) {
      this.lags.set(projectionName, []);
    }
    this.lags.get(projectionName)!.push(lagMs);
  }

  getAverageLag(projectionName: string): number {
    const values = this.lags.get(projectionName);
    if (!values || values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  getMaxLag(projectionName: string): number {
    const values = this.lags.get(projectionName);
    if (!values || values.length === 0) return 0;
    return Math.max(...values);
  }

  getSampleCount(projectionName: string): number {
    return this.lags.get(projectionName)?.length ?? 0;
  }

  isHealthy(projectionName: string, thresholdMs = DEFAULT_THRESHOLD_MS): boolean {
    return this.getMaxLag(projectionName) <= thresholdMs;
  }

  getReport(thresholdMs = DEFAULT_THRESHOLD_MS): ConsistencyReport {
    const projections: Record<string, ProjectionConsistencyStats> = {};
    let overallHealthy = true;

    for (const [name] of this.lags) {
      const healthy = this.isHealthy(name, thresholdMs);
      if (!healthy) overallHealthy = false;
      projections[name] = {
        averageLagMs: this.getAverageLag(name),
        maxLagMs: this.getMaxLag(name),
        sampleCount: this.getSampleCount(name),
        isHealthy: healthy,
      };
    }

    return { projections, overallHealthy };
  }

  reset(): void {
    this.lags.clear();
  }
}
