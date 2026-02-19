/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import { describe, it, expect, vi } from 'vitest';
import { Result } from '../src/primitives/Result';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ok42 = (): Result<number, Error> => Result.ok(42);
const errBoom = (): Result<number, Error> => Result.err(new Error('boom'));

/** Wraps a value in a genuine Promise without using async/await. */
function toPromise<T>(value: T): Promise<T> {
  return new Promise<T>((resolve) => {
    resolve(value);
  });
}

// ---------------------------------------------------------------------------
// Suite 1: matchAsync — async pattern matching
// ---------------------------------------------------------------------------

describe('Result.matchAsync', () => {
  it('returns a Promise', () => {
    const result = ok42().matchAsync({ ok: v => v * 2, err: () => 0 });
    expect(result).toBeInstanceOf(Promise);
  });

  it('resolves to the ok branch value for an Ok result', async () => {
    const value = await ok42().matchAsync({ ok: v => v * 2, err: () => 0 });
    expect(value).toBe(84);
  });

  it('resolves to the err branch value for an Err result', async () => {
    const value = await errBoom().matchAsync({
      ok: () => 'ok',
      err: e => `error:${e.message}`,
    });
    expect(value).toBe('error:boom');
  });

  it('works with a Promise-returning ok callback', async () => {
    const value = await ok42().matchAsync({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      ok: (v): Promise<number> => toPromise(v + 10),
      err: (): Promise<number> => toPromise(0),
    });
    expect(value).toBe(52);
  });

  it('works with a Promise-returning err callback', async () => {
    const value = await errBoom().matchAsync({
      ok: (): Promise<string> => toPromise('ok'),
      err: (e): Promise<string> => toPromise(`async:${e.message}`),
    });
    expect(value).toBe('async:boom');
  });
});

// ---------------------------------------------------------------------------
// Suite 2: tap / tapErr — observable side-effects
// ---------------------------------------------------------------------------

describe('Result.tap / tapErr', () => {
  it('tap invokes the callback with the Ok value', () => {
    const spy = vi.fn();
    ok42().tap(spy);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(42);
  });

  it('tap does not invoke the callback on Err', () => {
    const spy = vi.fn();
    errBoom().tap(spy);
    expect(spy).not.toHaveBeenCalled();
  });

  it('tapErr invokes the callback with the Err value', () => {
    const spy = vi.fn();
    const err = new Error('oops');
    Result.err<number, Error>(err).tapErr(spy);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(err);
  });

  it('tapErr does not invoke the callback on Ok', () => {
    const spy = vi.fn();
    ok42().tapErr(spy);
    expect(spy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Suite 3: filter — guard clause
// ---------------------------------------------------------------------------

describe('Result.filter', () => {
  it('returns the same Ok result when the predicate is true', () => {
    const result = ok42().filter(v => v > 0, () => new Error('negative'));
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(42);
  });

  it('converts to Err when the predicate is false', () => {
    const result = ok42().filter(v => v < 0, () => new Error('not-negative'));
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toBe('not-negative');
  });

  it('errFactory receives the value that failed the predicate', () => {
    const result = ok42().filter(v => v > 100, v => new Error(`${v} too small`));
    expect(result.unwrapErr().message).toBe('42 too small');
  });

  it('has no effect on an already-Err result', () => {
    const spy = vi.fn(() => true);
    const result = errBoom().filter(spy, () => new Error('should not appear'));
    expect(result.isErr()).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Suite 4: matchGuard — guard-based pattern matching
// ---------------------------------------------------------------------------

describe('Result.matchGuard', () => {
  const gradeGuards = [
    { when: (v: number): boolean => v >= 90, produce: (): string => 'A' },
    { when: (v: number): boolean => v >= 80, produce: (): string => 'B' },
    { when: (v: number): boolean => v >= 70, produce: (): string => 'C' },
  ];

  it('returns the value from the first matching guard', () => {
    const label = Result.ok<number, Error>(95).matchGuard(gradeGuards, () => 'F');
    expect(label).toBe('A');
  });

  it('skips non-matching guards and returns the correct match', () => {
    const label = Result.ok<number, Error>(82).matchGuard(gradeGuards, () => 'F');
    expect(label).toBe('B');
  });

  it('evaluates guards in order — first match wins', () => {
    // 90 matches both the first (≥90) and second (≥80) guard; first should win
    const label = Result.ok<number, Error>(90).matchGuard(gradeGuards, () => 'F');
    expect(label).toBe('A');
  });

  it('invokes fallback when no guard matches', () => {
    const label = Result.ok<number, Error>(60).matchGuard(gradeGuards, () => 'F');
    expect(label).toBe('F');
  });

  it('invokes fallback when the result is Err', () => {
    const result = Result.err<number, Error>(new Error('no score'));
    const label = result.matchGuard(gradeGuards, r => (r.isErr() ? 'N/A' : 'F'));
    expect(label).toBe('N/A');
  });

  it('does not evaluate remaining guards after the first match', () => {
    const spy = vi.fn(() => false);
    Result.ok<number, Error>(95).matchGuard(
      [
        { when: (): boolean => true, produce: (): string => 'hit' },
        { when: spy, produce: (): string => 'unreachable' },
      ],
      (): string => 'fallback',
    );
    expect(spy).not.toHaveBeenCalled();
  });
});
