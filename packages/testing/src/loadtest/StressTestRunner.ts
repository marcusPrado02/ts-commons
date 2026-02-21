import type { LoadStage } from './LoadTestTypes';

/**
 * Builds stages for a stress test: ramp up in increments until a maximum
 * VU count, hold, then ramp back down.
 *
 * @example
 * ```typescript
 * const runner = new StressTestRunner();
 * runner.configure(200, 50, 30);
 * const stages = runner.buildStages();
 * ```
 */
export class StressTestRunner {
  private maxVus = 100;
  private stepSize = 20;
  private stepDurationSeconds = 30;

  configure(maxVus: number, stepSize: number, stepDurationSeconds: number): void {
    this.maxVus = maxVus;
    this.stepSize = stepSize;
    this.stepDurationSeconds = stepDurationSeconds;
  }

  getMaxVus(): number {
    return this.maxVus;
  }

  getStepSize(): number {
    return this.stepSize;
  }

  getStepDurationSeconds(): number {
    return this.stepDurationSeconds;
  }

  stepCount(): number {
    return Math.ceil(this.maxVus / this.stepSize);
  }

  buildStages(): LoadStage[] {
    const stages: LoadStage[] = [];
    for (let vus = this.stepSize; vus <= this.maxVus; vus += this.stepSize) {
      stages.push({ durationSeconds: this.stepDurationSeconds, targetVus: vus });
    }
    stages.push({
      durationSeconds: this.stepDurationSeconds * 2,
      targetVus: this.maxVus,
    });
    stages.push({ durationSeconds: this.stepDurationSeconds, targetVus: 0 });
    return stages;
  }

  estimateDurationSeconds(): number {
    const rampSeconds = this.stepCount() * this.stepDurationSeconds;
    const holdSeconds = this.stepDurationSeconds * 2;
    const rampDownSeconds = this.stepDurationSeconds;
    return rampSeconds + holdSeconds + rampDownSeconds;
  }

  reset(): void {
    this.maxVus = 100;
    this.stepSize = 20;
    this.stepDurationSeconds = 30;
  }
}
