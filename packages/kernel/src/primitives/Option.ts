/**
 * Option type for representing optional values.
 * Either Some(value) or None.
 */
export class Option<T> {
  private constructor(
    private readonly _isSome: boolean,
    private readonly _value?: T,
  ) {}

  static some<T>(value: T): Option<T> {
    return new Option<T>(true, value);
  }

  static none<T>(): Option<T> {
    return new Option<T>(false, undefined);
  }

  static fromNullable<T>(value: T | null | undefined): Option<T> {
    return value !== null && value !== undefined ? Option.some(value) : Option.none();
  }

  isSome(): this is { unwrap(): T } {
    return this._isSome;
  }

  isNone(): boolean {
    return !this._isSome;
  }

  unwrap(): T {
    if (!this._isSome) {
      throw new Error('Called unwrap on None');
    }
    return this._value as T;
  }

  unwrapOr(defaultValue: T): T {
    return this._isSome ? (this._value as T) : defaultValue;
  }

  map<U>(fn: (value: T) => U): Option<U> {
    return this._isSome ? Option.some(fn(this._value as T)) : Option.none();
  }

  flatMap<U>(fn: (value: T) => Option<U>): Option<U> {
    return this._isSome ? fn(this._value as T) : Option.none();
  }

  filter(predicate: (value: T) => boolean): Option<T> {
    return this._isSome && predicate(this._value as T) ? this : Option.none();
  }

  match<U>(patterns: { some: (value: T) => U; none: () => U }): U {
    return this._isSome ? patterns.some(this._value as T) : patterns.none();
  }

  toNullable(): T | null {
    return this._isSome ? (this._value as T) : null;
  }
}
