/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { describe, it, expect } from 'vitest';
import { Result } from '../src/primitives/Result';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ok = <T>(v: T): Result<T, Error> => Result.ok(v);
const err = (msg: string): Result<number, Error> => Result.err(new Error(msg));

// ---------------------------------------------------------------------------
// Suite 1: Result.all
// ---------------------------------------------------------------------------

describe('Result.all', () => {
  it('returns Ok with all values when every result is Ok', () => {
    const result = Result.all([ok(1), ok(2), ok(3)]);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual([1, 2, 3]);
  });

  it('returns the first Err when any result is Err', () => {
    const result = Result.all([ok(1), err('fail'), ok(3)]);
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toBe('fail');
  });

  it('short-circuits at the first Err', () => {
    const result = Result.all([err('first'), err('second'), ok(3)]);
    expect(result.unwrapErr().message).toBe('first');
  });

  it('returns Ok with an empty array for an empty input', () => {
    const result = Result.all<number, Error>([]);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual([]);
  });

  it('returns Ok for a single Ok result', () => {
    const result = Result.all([ok(42)]);
    expect(result.unwrap()).toEqual([42]);
  });
});

// ---------------------------------------------------------------------------
// Suite 2: Result.any
// ---------------------------------------------------------------------------

describe('Result.any', () => {
  it('returns the first Ok result', () => {
    const result = Result.any([err('a'), ok(2), ok(3)]);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(2);
  });

  it('returns the last Err when all results are Err', () => {
    const result = Result.any([err('first'), err('last')]);
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toBe('last');
  });

  it('throws when called with an empty array', () => {
    expect(() => Result.any([])).toThrow();
  });

  it('returns the only Ok result from a single-element array', () => {
    const result = Result.any([ok(99)]);
    expect(result.unwrap()).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// Suite 3: Result.traverse + Result.partition
// ---------------------------------------------------------------------------

describe('Result.traverse', () => {
  it('maps all items and collects Ok values', () => {
    const result = Result.traverse([1, 2, 3], v => ok(v * 10));
    expect(result.unwrap()).toEqual([10, 20, 30]);
  });

  it('short-circuits on the first Err', () => {
    const result = Result.traverse([1, 2, 3], v =>
      v === 2 ? err('bad') : ok(v),
    );
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toBe('bad');
  });

  it('returns Ok with an empty array for an empty input', () => {
    const result = Result.traverse<number, number, Error>([], v => ok(v));
    expect(result.unwrap()).toEqual([]);
  });
});

describe('Result.partition', () => {
  it('separates Ok and Err results into two arrays', () => {
    const results = [ok(1), err('a'), ok(3), err('b')];
    const { oks, errs } = Result.partition(results);
    expect(oks).toEqual([1, 3]);
    expect(errs.map(e => e.message)).toEqual(['a', 'b']);
  });

  it('returns only oks when all results are Ok', () => {
    const { oks, errs } = Result.partition([ok(1), ok(2)]);
    expect(oks).toEqual([1, 2]);
    expect(errs).toHaveLength(0);
  });

  it('returns only errs when all results are Err', () => {
    const { oks, errs } = Result.partition([err('x'), err('y')]);
    expect(oks).toHaveLength(0);
    expect(errs).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Suite 4: andThen + orElse
// ---------------------------------------------------------------------------

describe('Result.andThen / orElse', () => {
  it('andThen passes the Ok value to fn and returns its result', async () => {
    const result = await ok(5).andThen(v => ok(v * 2));
    expect(result.unwrap()).toBe(10);
  });

  it('andThen propagates Err without calling fn', async () => {
    let called = false;
    const result = await err('boom').andThen(() => {
      called = true;
      return ok(99);
    });
    expect(result.isErr()).toBe(true);
    expect(called).toBe(false);
  });

  it('andThen works with a Promise-returning fn', async () => {
    const result = await ok(3).andThen(
      (v): Promise<Result<number, Error>> =>
        new Promise((resolve) => {
          resolve(ok(v + 10));
        }),
    );
    expect(result.unwrap()).toBe(13);
  });

  it('orElse returns the original Ok result unchanged', () => {
    const result = ok(7).orElse(() => ok(0));
    expect(result.unwrap()).toBe(7);
  });

  it('orElse recovers from Err using the provided factory', () => {
    const result = err('oops').orElse(() => ok(-1));
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(-1);
  });
});
