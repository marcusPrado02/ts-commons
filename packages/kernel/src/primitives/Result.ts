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

  /**
   * Async variant of {@link match}. Each branch may return a plain value or a
   * Promise; the result is always wrapped in a `Promise`.
   */
  async matchAsync<U>(patterns: {
    ok: (value: T) => Promise<U> | U;
    err: (error: E) => Promise<U> | U;
  }): Promise<U> {
    return this._isOk
      ? Promise.resolve(patterns.ok(this._value as T))
      : Promise.resolve(patterns.err(this._error as E));
  }

  /**
   * Runs a side-effect on the contained value when `Ok`, then returns the
   * original result unchanged. Useful for logging and debugging.
   */
  tap(fn: (value: T) => void): Result<T, E> {
    if (this._isOk) fn(this._value as T);
    return this;
  }

  /**
   * Runs a side-effect on the contained error when `Err`, then returns the
   * original result unchanged.
   */
  tapErr(fn: (error: E) => void): Result<T, E> {
    if (!this._isOk) fn(this._error as E);
    return this;
  }

  /**
   * Converts an `Ok` result into an `Err` when the guard predicate returns
   * `false`. Has no effect on an already-`Err` result.
   */
  filter(predicate: (value: T) => boolean, errFactory: (value: T) => E): Result<T, E> {
    if (!this._isOk) return this;
    const value = this._value as T;
    return predicate(value) ? this : Result.err(errFactory(value));
  }

  /**
   * Guard-based pattern matching for `Ok` values. Guards are evaluated in
   * order; the first whose `when` predicate returns `true` wins. If the result
   * is `Err`, or no guard matches, `fallback` is invoked with the full result.
   *
   * @example
   * ```ts
   * const label = score.matchGuard(
   *   [
   *     { when: v => v >= 90, then: () => 'A' },
   *     { when: v => v >= 80, then: () => 'B' },
   *     { when: v => v >= 70, then: () => 'C' },
   *   ],
   *   () => 'F',
   * );
   * ```
   */
  matchGuard<U>(
    guards: ReadonlyArray<{ when: (value: T) => boolean; produce: (value: T) => U }>,
    fallback: (result: Result<T, E>) => U,
  ): U {
    if (this._isOk) {
      const value = this._value as T;
      for (const guard of guards) {
        if (guard.when(value)) return guard.produce(value);
      }
    }
    return fallback(this);
  }
}
