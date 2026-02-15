/**
 * Either type for representing one of two possible values.
 * Conventionally Left is used for errors and Right for success.
 */
export class Either<L, R> {
  private constructor(
    private readonly _isRight: boolean,
    private readonly _left?: L,
    private readonly _right?: R,
  ) {}

  static left<L, R>(value: L): Either<L, R> {
    return new Either<L, R>(false, value, undefined);
  }

  static right<L, R>(value: R): Either<L, R> {
    return new Either<L, R>(true, undefined, value);
  }

  isLeft(): this is { getLeft(): L } {
    return !this._isRight;
  }

  isRight(): this is { getRight(): R } {
    return this._isRight;
  }

  getLeft(): L {
    if (this._isRight) {
      throw new Error('Called getLeft on Right');
    }
    return this._left as L;
  }

  getRight(): R {
    if (!this._isRight) {
      throw new Error('Called getRight on Left');
    }
    return this._right as R;
  }

  map<T>(fn: (value: R) => T): Either<L, T> {
    return this._isRight ? Either.right(fn(this._right as R)) : Either.left(this._left as L);
  }

  mapLeft<T>(fn: (value: L) => T): Either<T, R> {
    return this._isRight ? Either.right(this._right as R) : Either.left(fn(this._left as L));
  }

  flatMap<T>(fn: (value: R) => Either<L, T>): Either<L, T> {
    return this._isRight ? fn(this._right as R) : Either.left(this._left as L);
  }

  match<T>(patterns: { left: (value: L) => T; right: (value: R) => T }): T {
    return this._isRight ? patterns.right(this._right as R) : patterns.left(this._left as L);
  }
}
