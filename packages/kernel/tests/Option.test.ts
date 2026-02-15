import { describe, it, expect } from 'vitest';
import { Option } from '../src/primitives/Option';

describe('Option', () => {
  describe('some', () => {
    it('should create Some with value', () => {
      const option = Option.some(42);

      expect(option.isSome()).toBe(true);
      expect(option.isNone()).toBe(false);
      expect(option.unwrap()).toBe(42);
    });

    it('should work with objects', () => {
      const value = { id: 1, name: 'Test' };
      const option = Option.some(value);

      expect(option.unwrap()).toEqual(value);
    });
  });

  describe('none', () => {
    it('should create None', () => {
      const option = Option.none<number>();

      expect(option.isSome()).toBe(false);
      expect(option.isNone()).toBe(true);
    });
  });

  describe('fromNullable', () => {
    it('should create Some from non-null value', () => {
      const option = Option.fromNullable(42);

      expect(option.isSome()).toBe(true);
      expect(option.unwrap()).toBe(42);
    });

    it('should create None from null', () => {
      const option = Option.fromNullable(null);

      expect(option.isNone()).toBe(true);
    });

    it('should create None from undefined', () => {
      const option = Option.fromNullable(undefined);

      expect(option.isNone()).toBe(true);
    });

    it('should handle falsy values correctly', () => {
      expect(Option.fromNullable(0).isSome()).toBe(true);
      expect(Option.fromNullable('').isSome()).toBe(true);
      expect(Option.fromNullable(false).isSome()).toBe(true);
    });
  });

  describe('unwrap', () => {
    it('should return value for Some', () => {
      const option = Option.some(123);
      expect(option.unwrap()).toBe(123);
    });

    it('should throw for None', () => {
      const option = Option.none();
      expect(() => option.unwrap()).toThrow('Called unwrap on None');
    });
  });

  describe('unwrapOr', () => {
    it('should return value for Some', () => {
      const option = Option.some(10);
      expect(option.unwrapOr(999)).toBe(10);
    });

    it('should return default for None', () => {
      const option = Option.none<number>();
      expect(option.unwrapOr(999)).toBe(999);
    });
  });

  describe('map', () => {
    it('should transform Some value', () => {
      const option = Option.some(5);
      const mapped = option.map(x => x * 2);

      expect(mapped.isSome()).toBe(true);
      expect(mapped.unwrap()).toBe(10);
    });

    it('should preserve None', () => {
      const option = Option.none<number>();
      const mapped = option.map(x => x * 2);

      expect(mapped.isNone()).toBe(true);
    });

    it('should work with type transformation', () => {
      const option = Option.some(42);
      const mapped = option.map(x => `Value: ${x}`);

      expect(mapped.unwrap()).toBe('Value: 42');
    });
  });

  describe('flatMap', () => {
    it('should chain Some values', () => {
      const option = Option.some(5);
      const chained = option.flatMap(x => Option.some(x * 2));

      expect(chained.isSome()).toBe(true);
      expect(chained.unwrap()).toBe(10);
    });

    it('should short-circuit on None', () => {
      const option = Option.none<number>();
      const chained = option.flatMap(x => Option.some(x * 2));

      expect(chained.isNone()).toBe(true);
    });

    it('should propagate None from mapper', () => {
      const option = Option.some(5);
      const chained = option.flatMap(_ => Option.none());

      expect(chained.isNone()).toBe(true);
    });
  });

  describe('filter', () => {
    it('should keep Some when predicate is true', () => {
      const option = Option.some(10);
      const filtered = option.filter(x => x > 5);

      expect(filtered.isSome()).toBe(true);
      expect(filtered.unwrap()).toBe(10);
    });

    it('should return None when predicate is false', () => {
      const option = Option.some(3);
      const filtered = option.filter(x => x > 5);

      expect(filtered.isNone()).toBe(true);
    });

    it('should preserve None', () => {
      const option = Option.none<number>();
      const filtered = option.filter(x => x > 5);

      expect(filtered.isNone()).toBe(true);
    });
  });

  describe('match', () => {
    it('should call some handler for Some', () => {
      const option = Option.some(42);
      const value = option.match({
        some: v => `Value: ${v}`,
        none: () => 'No value',
      });

      expect(value).toBe('Value: 42');
    });

    it('should call none handler for None', () => {
      const option = Option.none<number>();
      const value = option.match({
        some: v => `Value: ${v}`,
        none: () => 'No value',
      });

      expect(value).toBe('No value');
    });
  });

  describe('toNullable', () => {
    it('should return value for Some', () => {
      const option = Option.some(42);
      expect(option.toNullable()).toBe(42);
    });

    it('should return null for None', () => {
      const option = Option.none<number>();
      expect(option.toNullable()).toBe(null);
    });
  });
});
