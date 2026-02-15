import { ValueObject } from '../ddd/ValueObject';

/**
 * Represents a point in time.
 */
export class Instant extends ValueObject<number> {
  private constructor(timestamp: number) {
    super(timestamp);
  }

  static now(): Instant {
    return new Instant(Date.now());
  }

  static fromTimestamp(timestamp: number): Instant {
    return new Instant(timestamp);
  }

  static fromDate(date: Date): Instant {
    return new Instant(date.getTime());
  }

  toDate(): Date {
    return new Date(this._value);
  }

  toTimestamp(): number {
    return this._value;
  }

  isBefore(other: Instant): boolean {
    return this._value < other._value;
  }

  isAfter(other: Instant): boolean {
    return this._value > other._value;
  }

  plus(milliseconds: number): Instant {
    return new Instant(this._value + milliseconds);
  }

  minus(milliseconds: number): Instant {
    return new Instant(this._value - milliseconds);
  }
}
