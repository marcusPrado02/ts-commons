/**
 * Base ValueObject for DDD value objects.
 * Value objects are immutable and compared by value, not identity.
 */
export abstract class ValueObject<T> {
  constructor(protected readonly _value: T) {
    Object.freeze(this);
  }

  get value(): T {
    return this._value;
  }

  equals(other: ValueObject<T>): boolean {
    if (!(other instanceof ValueObject)) {
      return false;
    }
    return this.compareTo(other._value);
  }

  /**
   * Override this method for complex value comparison.
   */
  protected compareTo(otherValue: T): boolean {
    if (typeof this._value === 'object' && this._value !== null) {
      return JSON.stringify(this._value) === JSON.stringify(otherValue);
    }
    return this._value === otherValue;
  }

  toString(): string {
    return String(this._value);
  }
}
