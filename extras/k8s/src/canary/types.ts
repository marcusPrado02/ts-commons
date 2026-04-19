/**
 * Canary release types.
 */

export interface CanaryConfig {
  appName: string;
  namespace: string;
  stableImage: string;
  canaryImage: string;
  /** Initial traffic % sent to canary (0-100) */
  initialWeight?: number;
  /** Step size when incrementing weight */
  stepSize?: number;
  /** Interval (ms) between automatic increments */
  stepIntervalMs?: number;
  /** Threshold above which error rate triggers auto-rollback (0-1) */
  errorRateThreshold?: number;
  /** Baseline latency (ms) — increase > 20% triggers alert */
  baselineLatencyMs?: number;
}

export interface CanaryMetrics {
  errorRate: number; // 0–1
  p99LatencyMs: number;
  requestsPerSecond: number;
  successRate: number; // 0–1
}

export interface CanaryStatus {
  canaryWeight: number; // current % of traffic to canary
  stable: CanaryMetrics;
  canary: CanaryMetrics;
  phase: CanaryPhase;
  startedAt: Date;
  lastUpdatedAt: Date;
}

export type CanaryPhase =
  | 'initializing'
  | 'progressing'
  | 'paused'
  | 'succeeded'
  | 'failed'
  | 'rollback';

export interface CanaryAnalysisResult {
  passed: boolean;
  reason: string;
  canaryMetrics: CanaryMetrics;
  stableMetrics: CanaryMetrics;
}

export interface MetricsProvider {
  getMetrics(target: 'stable' | 'canary'): Promise<CanaryMetrics>;
}
