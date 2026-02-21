import type { LoadStage } from './LoadTestTypes';

/**
 * Builds stages for a soak test: ramp up, sustain at target VUs for an
 * extended period, then ramp down. Used to detect memory leaks and
 * connection-pool exhaustion over time.
 *
 * @example
 * ```typescript
 * const runner = new SoakTestRunner();
 * runner.configure(50, 120); // 50 VUs for 2 hours
 * const stages = runner.buildStages();
 * ```
 */
export class SoakTestRunner {
  private targetVus = 50;
  private soakDurationMinutes = 60;
  private rampDurationSeconds = 60;

  configure(targetVus: number, soakDurationMinutes: number): void {
    this.targetVus = targetVus;
    this.soakDurationMinutes = soakDurationMinutes;
  }

  setRampDurationSeconds(seconds: number): void {
    this.rampDurationSeconds = seconds;
  }

  getRampDurationSeconds(): number {
    return this.rampDurationSeconds;
  }

  getTargetVus(): number {
    return this.targetVus;
  }

  getSoakDurationMinutes(): number {
    return this.soakDurationMinutes;
  }

  buildStages(): LoadStage[] {
    const soakSeconds = this.soakDurationMinutes * 60;
    return [
      { durationSeconds: this.rampDurationSeconds, targetVus: this.targetVus },
      { durationSeconds: soakSeconds, targetVus: this.targetVus },
      { durationSeconds: this.rampDurationSeconds, targetVus: 0 },
    ];
  }

  estimateTotalDurationSeconds(): number {
    return this.rampDurationSeconds + this.soakDurationMinutes * 60 + this.rampDurationSeconds;
  }

  estimateTotalDurationMinutes(): number {
    return Math.ceil(this.estimateTotalDurationSeconds() / 60);
  }

  reset(): void {
    this.targetVus = 50;
    this.soakDurationMinutes = 60;
    this.rampDurationSeconds = 60;
  }
}
