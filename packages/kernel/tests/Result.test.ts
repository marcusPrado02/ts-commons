import { describe, it, expect } from 'vitest';
import { Result } from '../src/primitives/Result';

describe('Result', () => {
  describe('ok', () => {
    it('should create a successful result', () => {
      const result = Result.ok(42);

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);
      expect(result.unwrap()).toBe(42);
    });

    it('should work with complex values', () => {
      const value = { id: 1, name: 'Test' };
      const result = Result.ok(value);

      expect(result.unwrap()).toEqual(value);
    });
  });

  describe('err', () => {
    it('should create an error result', () => {
      const error = new Error('Test error');
      const result = Result.err(error);

      expect(result.isOk()).toBe(false);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe(error);
    });

    it('should work with custom error types', () => {
      const result = Result.err('Custom error');

      expect(result.unwrapErr()).toBe('Custom error');
    });
  });

  describe('unwrap', () => {
    it('should return the value for Ok', () => {
      const result = Result.ok(123);
      expect(result.unwrap()).toBe(123);
    });

    it('should throw for Err', () => {
      const result = Result.err(new Error('fail'));
      expect(() => result.unwrap()).toThrow('Called unwrap on an Err value');
    });
  });

  describe('unwrapErr', () => {
    it('should return the error for Err', () => {
      const error = new Error('test');
      const result = Result.err(error);
      expect(result.unwrapErr()).toBe(error);
    });

    it('should throw for Ok', () => {
      const result = Result.ok(42);
      expect(() => result.unwrapErr()).toThrow('Called unwrapErr on an Ok value');
    });
  });

  describe('unwrapOr', () => {
    it('should return the value for Ok', () => {
      const result = Result.ok(10);
      expect(result.unwrapOr(999)).toBe(10);
    });

    it('should return default for Err', () => {
      const result = Result.err(new Error());
      expect(result.unwrapOr(999)).toBe(999);
    });
  });

  describe('map', () => {
    it('should transform Ok value', () => {
      const result = Result.ok(5);
      const mapped = result.map(x => x * 2);

      expect(mapped.isOk()).toBe(true);
      expect(mapped.unwrap()).toBe(10);
    });

    it('should preserve Err', () => {
      const error = new Error('fail');
      const result = Result.err<number>(error);
      const mapped = result.map(x => x * 2);

      expect(mapped.isErr()).toBe(true);
      expect(mapped.unwrapErr()).toBe(error);
    });
  });

  describe('mapErr', () => {
    it('should transform Err value', () => {
      const result = Result.err<number, string>('error');
      const mapped = result.mapErr(e => e.toUpperCase());

      expect(mapped.isErr()).toBe(true);
      expect(mapped.unwrapErr()).toBe('ERROR');
    });

    it('should preserve Ok', () => {
      const result = Result.ok<number, string>(42);
      const mapped = result.mapErr(e => e.toUpperCase());

      expect(mapped.isOk()).toBe(true);
      expect(mapped.unwrap()).toBe(42);
    });
  });

  describe('flatMap', () => {
    it('should chain Ok results', () => {
      const result = Result.ok(5);
      const chained = result.flatMap(x => Result.ok(x * 2));

      expect(chained.isOk()).toBe(true);
      expect(chained.unwrap()).toBe(10);
    });

    it('should short-circuit on Err', () => {
      const error = new Error('fail');
      const result = Result.err<number>(error);
      const chained = result.flatMap(x => Result.ok(x * 2));

      expect(chained.isErr()).toBe(true);
      expect(chained.unwrapErr()).toBe(error);
    });

    it('should propagate new errors', () => {
      const result = Result.ok(5);
      const newError = new Error('new error');
      const chained = result.flatMap(_ => Result.err(newError));

      expect(chained.isErr()).toBe(true);
      expect(chained.unwrapErr()).toBe(newError);
    });
  });

  describe('match', () => {
    it('should call ok handler for Ok', () => {
      const result = Result.ok(42);
      const value = result.match({
        ok: v => `Success: ${String(v)}`,
        err: e => `Error: ${String(e)}`,
      });

      expect(value).toBe('Success: 42');
    });

    it('should call err handler for Err', () => {
      const result = Result.err('failure');
      const value = result.match({
        ok: v => `Success: ${String(v)}`,
        err: e => `Error: ${String(e)}`,
      });

      expect(value).toBe('Error: failure');
    });
  });
});
