/**
 * Result type for railway-oriented programming.
 * Represents either success (Ok) or failure (Err).
 */
export class Result<T, E = Error> {
  private constructor(
    private readonly _isOk: boolean,
    private readonly _value?: T,
    private readonly _error?: E,
  ) {}

  static ok<T, E = Error>(value: T): Result<T, E> {
    return new Result<T, E>(true, value, undefined);
  }

  static err<T, E = Error>(error: E): Result<T, E> {
    return new Result<T, E>(false, undefined, error);
  }

  isOk(): this is { unwrap(): T } {
    return this._isOk;
  }

  isErr(): this is { unwrapErr(): E } {
    return !this._isOk;
  }

  unwrap(): T {
    if (!this._isOk) {
      throw new Error('Called unwrap on an Err value');
    }
    return this._value as T;
  }

  unwrapErr(): E {
    if (this._isOk) {
      throw new Error('Called unwrapErr on an Ok value');
    }
    return this._error as E;
  }

  unwrapOr(defaultValue: T): T {
    return this._isOk ? (this._value as T) : defaultValue;
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    return this._isOk ? Result.ok(fn(this._value as T)) : Result.err(this._error as E);
  }

  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    return this._isOk ? Result.ok(this._value as T) : Result.err(fn(this._error as E));
  }

  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return this._isOk ? fn(this._value as T) : Result.err(this._error as E);
  }

  match<U>(patterns: { ok: (value: T) => U; err: (error: E) => U }): U {
    return this._isOk ? patterns.ok(this._value as T) : patterns.err(this._error as E);
  }
}
