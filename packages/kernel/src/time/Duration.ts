import { ValueObject } from '../ddd/ValueObject';

/**
 * Represents a duration of time in milliseconds.
 */
export class Duration extends ValueObject<number> {
  private constructor(milliseconds: number) {
    if (milliseconds < 0) {
      throw new Error('Duration cannot be negative');
    }
    super(milliseconds);
  }

  static ofMilliseconds(ms: number): Duration {
    return new Duration(ms);
  }

  static ofSeconds(seconds: number): Duration {
    return new Duration(seconds * 1000);
  }

  static ofMinutes(minutes: number): Duration {
    return new Duration(minutes * 60 * 1000);
  }

  static ofHours(hours: number): Duration {
    return new Duration(hours * 60 * 60 * 1000);
  }

  static ofDays(days: number): Duration {
    return new Duration(days * 24 * 60 * 60 * 1000);
  }

  toMilliseconds(): number {
    return this._value;
  }

  toSeconds(): number {
    return this._value / 1000;
  }

  toMinutes(): number {
    return this._value / (60 * 1000);
  }

  toHours(): number {
    return this._value / (60 * 60 * 1000);
  }

  toDays(): number {
    return this._value / (24 * 60 * 60 * 1000);
  }

  plus(other: Duration): Duration {
    return new Duration(this._value + other._value);
  }

  minus(other: Duration): Duration {
    return new Duration(this._value - other._value);
  }
}
