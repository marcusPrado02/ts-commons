import type { LoadStage } from './LoadTestTypes';

/**
 * Builds stages for a spike test: baseline load → sudden large spike → recovery.
 *
 * @example
 * ```typescript
 * const runner = new SpikeTestRunner();
 * runner.configure(10, 500, 30);
 * const stages = runner.buildStages();
 * ```
 */
export class SpikeTestRunner {
  private normalVus = 10;
  private spikeVus = 200;
  private spikeDurationSeconds = 30;
  private rampSeconds = 10;

  configure(normalVus: number, spikeVus: number, spikeDurationSeconds: number): void {
    this.normalVus = normalVus;
    this.spikeVus = spikeVus;
    this.spikeDurationSeconds = spikeDurationSeconds;
  }

  setRampSeconds(seconds: number): void {
    this.rampSeconds = seconds;
  }

  getRampSeconds(): number {
    return this.rampSeconds;
  }

  getNormalVus(): number {
    return this.normalVus;
  }

  getSpikeVus(): number {
    return this.spikeVus;
  }

  getSpikeDurationSeconds(): number {
    return this.spikeDurationSeconds;
  }

  /**
   * Ratio between spike VUs and normal VUs.
   * Returns 0 when normal VUs is 0 to avoid division by zero.
   */
  spikeRatio(): number {
    if (this.normalVus === 0) return 0;
    return this.spikeVus / this.normalVus;
  }

  buildStages(): LoadStage[] {
    return [
      { durationSeconds: 60, targetVus: this.normalVus },
      { durationSeconds: this.rampSeconds, targetVus: this.spikeVus },
      { durationSeconds: this.spikeDurationSeconds, targetVus: this.spikeVus },
      { durationSeconds: this.rampSeconds, targetVus: this.normalVus },
      { durationSeconds: 60, targetVus: this.normalVus },
    ];
  }

  estimateTotalDurationSeconds(): number {
    return 60 + this.rampSeconds + this.spikeDurationSeconds + this.rampSeconds + 60;
  }

  reset(): void {
    this.normalVus = 10;
    this.spikeVus = 200;
    this.spikeDurationSeconds = 30;
    this.rampSeconds = 10;
  }
}
