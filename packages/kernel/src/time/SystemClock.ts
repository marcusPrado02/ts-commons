import type { Clock } from './Clock';

/**
 * System clock implementation using real time.
 */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  timestamp(): number {
    return Date.now();
  }
}
