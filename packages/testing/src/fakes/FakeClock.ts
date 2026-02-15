import type { Clock } from '@acme/kernel';

/**
 * Fake clock for testing time-dependent code.
 */
export class FakeClock implements Clock {
  constructor(private currentTime: Date = new Date()) {}

  now(): Date {
    return this.currentTime;
  }

  timestamp(): number {
    return this.currentTime.getTime();
  }

  setTime(time: Date): void {
    this.currentTime = time;
  }

  advance(ms: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + ms);
  }
}
