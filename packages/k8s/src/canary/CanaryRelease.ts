/* eslint-disable @typescript-eslint/require-await */
import type {
  CanaryAnalysisResult,
  CanaryConfig,
  CanaryMetrics,
  CanaryPhase,
  CanaryStatus,
  MetricsProvider,
} from './types';

/**
 * Canary release controller.
 *
 * Manages gradual traffic shifting with metrics-based promotion or rollback.
 */
export class CanaryRelease {
  private canaryWeight: number;
  private phase: CanaryPhase = 'initializing';
  private readonly startedAt = new Date();
  private lastUpdatedAt = new Date();
  private readonly stepSize: number;
  private readonly errorRateThreshold: number;
  private readonly baselineLatencyMs: number;
  private readonly alertHandlers: Array<(reason: string) => void> = [];
  private readonly phaseHandlers: Array<(phase: CanaryPhase) => void> = [];

  constructor(
    private readonly config: CanaryConfig,
    private readonly metrics: MetricsProvider,
  ) {
    this.canaryWeight = config.initialWeight ?? 5;
    this.stepSize = config.stepSize ?? 10;
    this.errorRateThreshold = config.errorRateThreshold ?? 0.05;
    this.baselineLatencyMs = config.baselineLatencyMs ?? 200;
  }

  /** Analyse current metrics and decide to promote, hold, or rollback. */
  async analyse(): Promise<CanaryAnalysisResult> {
    const [stable, canary] = await Promise.all([
      this.metrics.getMetrics('stable'),
      this.metrics.getMetrics('canary'),
    ]);
    const passed = this.meetsThresholds(canary, stable);
    if (!passed) {
      this.setPhase('failed');
    }
    return {
      passed,
      reason: passed
        ? 'Canary metrics within acceptable thresholds'
        : this.buildFailureReason(canary, stable),
      canaryMetrics: canary,
      stableMetrics: stable,
    };
  }

  /** Increment canary weight by stepSize. Returns new weight. */
  async promote(): Promise<number> {
    const result = await this.analyse();
    if (!result.passed) {
      this.setPhase('failed');
      for (const h of this.alertHandlers) h(result.reason);
      return this.canaryWeight;
    }
    this.canaryWeight = Math.min(100, this.canaryWeight + this.stepSize);
    this.lastUpdatedAt = new Date();
    if (this.canaryWeight >= 100) {
      this.setPhase('succeeded');
    } else {
      this.setPhase('progressing');
    }
    return this.canaryWeight;
  }

  /** Roll all traffic back to stable. */
  async rollback(reason = 'Manual rollback'): Promise<void> {
    this.canaryWeight = 0;
    this.lastUpdatedAt = new Date();
    this.setPhase('rollback');
    for (const h of this.alertHandlers) h(reason);
  }

  /** Pause the canary (hold weight, no auto-increment). */
  pause(): void {
    this.setPhase('paused');
  }

  /** Resume from paused. */
  resume(): void {
    if (this.phase === 'paused') this.setPhase('progressing');
  }

  async getStatus(): Promise<CanaryStatus> {
    const [stable, canary] = await Promise.all([
      this.metrics.getMetrics('stable'),
      this.metrics.getMetrics('canary'),
    ]);
    return {
      canaryWeight: this.canaryWeight,
      stable,
      canary,
      phase: this.phase,
      startedAt: this.startedAt,
      lastUpdatedAt: this.lastUpdatedAt,
    };
  }

  /** Register an alert handler called on rollback or failure. */
  onAlert(handler: (reason: string) => void): () => void {
    this.alertHandlers.push(handler);
    return () => {
      const idx = this.alertHandlers.indexOf(handler);
      if (idx !== -1) this.alertHandlers.splice(idx, 1);
    };
  }

  /** Register a phase change handler. */
  onPhaseChange(handler: (phase: CanaryPhase) => void): () => void {
    this.phaseHandlers.push(handler);
    return () => {
      const idx = this.phaseHandlers.indexOf(handler);
      if (idx !== -1) this.phaseHandlers.splice(idx, 1);
    };
  }

  get weight(): number {
    return this.canaryWeight;
  }

  get currentPhase(): CanaryPhase {
    return this.phase;
  }

  private setPhase(phase: CanaryPhase): void {
    if (this.phase !== phase) {
      this.phase = phase;
      for (const h of this.phaseHandlers) h(phase);
    }
  }

  private meetsThresholds(canary: CanaryMetrics, stable: CanaryMetrics): boolean {
    if (canary.errorRate > this.errorRateThreshold) return false;
    if (canary.p99LatencyMs > this.baselineLatencyMs * 1.2) return false;
    if (canary.errorRate > stable.errorRate * 2) return false;
    return true;
  }

  private buildFailureReason(canary: CanaryMetrics, stable: CanaryMetrics): string {
    if (canary.errorRate > this.errorRateThreshold) {
      return `Canary error rate ${(canary.errorRate * 100).toFixed(1)}% exceeds threshold ${(this.errorRateThreshold * 100).toFixed(1)}%`;
    }
    if (canary.p99LatencyMs > this.baselineLatencyMs * 1.2) {
      return `Canary p99 latency ${canary.p99LatencyMs}ms exceeds baseline ${this.baselineLatencyMs}ms by >20%`;
    }
    return `Canary error rate ${(canary.errorRate * 100).toFixed(1)}% is 2x stable error rate ${(stable.errorRate * 100).toFixed(1)}%`;
  }
}
