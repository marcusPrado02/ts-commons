import { describe, it, expect } from 'vitest';
import { IdempotencyKey } from '../src';

describe('IdempotencyKey', () => {
  describe('create', () => {
    it('should create an idempotency key with valid value', () => {
      const key = IdempotencyKey.create('my-unique-key');

      expect(key).toBeDefined();
      expect(key.value).toBe('my-unique-key');
    });

    it('should trim whitespace from the value', () => {
      const key = IdempotencyKey.create('  trimmed-key  ');

      expect(key.value).toBe('trimmed-key');
    });

    it('should throw for empty string', () => {
      expect(() => IdempotencyKey.create('')).toThrow('IdempotencyKey cannot be empty');
    });

    it('should throw for whitespace-only string', () => {
      expect(() => IdempotencyKey.create('   ')).toThrow('IdempotencyKey cannot be empty');
    });

    it('should handle UUID format', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const key = IdempotencyKey.create(uuid);

      expect(key.value).toBe(uuid);
    });

    it('should handle various formats', () => {
      const formats = [
        'user-123-action-create',
        'ORDER_12345',
        'payment:abc123:retry-1',
        'complex.key.with.dots',
      ];

      formats.forEach(format => {
        const key = IdempotencyKey.create(format);
        expect(key.value).toBe(format);
      });
    });
  });

  describe('generate', () => {
    it('should generate a valid UUID', () => {
      const key = IdempotencyKey.generate();

      expect(key).toBeDefined();
      expect(key.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should generate unique keys', () => {
      const key1 = IdempotencyKey.generate();
      const key2 = IdempotencyKey.generate();
      const key3 = IdempotencyKey.generate();

      expect(key1.value).not.toBe(key2.value);
      expect(key2.value).not.toBe(key3.value);
      expect(key1.value).not.toBe(key3.value);
    });

    it('should generate many unique keys', () => {
      const keys = new Set<string>();
      const count = 100;

      for (let i = 0; i < count; i++) {
        keys.add(IdempotencyKey.generate().value);
      }

      expect(keys.size).toBe(count);
    });
  });

  describe('ValueObject behavior', () => {
    it('should be immutable', () => {
      const key = IdempotencyKey.create('test-key');

      expect(Object.isFrozen(key)).toBe(true);
    });

    it('should compare by value (equals)', () => {
      const key1 = IdempotencyKey.create('same-key');
      const key2 = IdempotencyKey.create('same-key');

      expect(key1.equals(key2)).toBe(true);
    });

    it('should return false for different values', () => {
      const key1 = IdempotencyKey.create('key-1');
      const key2 = IdempotencyKey.create('key-2');

      expect(key1.equals(key2)).toBe(false);
    });

    it('should have string representation', () => {
      const key = IdempotencyKey.create('my-key');

      expect(key.toString()).toBe('my-key');
    });

    it('should handle case-sensitive comparison', () => {
      const key1 = IdempotencyKey.create('MyKey');
      const key2 = IdempotencyKey.create('mykey');

      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe('use cases', () => {
    it('should work as map keys', () => {
      const map = new Map<string, IdempotencyKey>();
      const key1 = IdempotencyKey.create('key-1');
      const key2 = IdempotencyKey.create('key-2');

      map.set(key1.value, key1);
      map.set(key2.value, key2);

      expect(map.get('key-1')).toBe(key1);
      expect(map.get('key-2')).toBe(key2);
    });

    it('should work in sets (by value)', () => {
      const key1 = IdempotencyKey.create('unique');
      const key2 = IdempotencyKey.create('unique');
      const key3 = IdempotencyKey.create('different');

      const values = new Set([key1.value, key2.value, key3.value]);

      expect(values.size).toBe(2);
      expect(values.has('unique')).toBe(true);
      expect(values.has('different')).toBe(true);
    });

    it('should support request deduplication scenario', () => {
      const processedRequests = new Set<string>();

      function processRequest(key: IdempotencyKey): boolean {
        if (processedRequests.has(key.value)) {
          return false; // Already processed
        }
        processedRequests.add(key.value);
        return true; // Newly processed
      }

      const key = IdempotencyKey.create('request-123');

      expect(processRequest(key)).toBe(true); // First time
      expect(processRequest(key)).toBe(false); // Duplicate
      expect(processRequest(IdempotencyKey.create('request-123'))).toBe(false); // Same value
      expect(processRequest(IdempotencyKey.create('request-456'))).toBe(true); // Different request
    });

    it('should support correlation with external IDs', () => {
      function createKeyForOrder(orderId: string, action: string): IdempotencyKey {
        return IdempotencyKey.create(`order-${orderId}-${action}`);
      }

      const createKey = createKeyForOrder('12345', 'create');
      const updateKey = createKeyForOrder('12345', 'update');

      expect(createKey.value).toBe('order-12345-create');
      expect(updateKey.value).toBe('order-12345-update');
      expect(createKey.equals(updateKey)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle very long keys', () => {
      const longKey = 'a'.repeat(1000);
      const key = IdempotencyKey.create(longKey);

      expect(key.value).toBe(longKey);
    });

    it('should handle special characters', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const key = IdempotencyKey.create(specialChars);

      expect(key.value).toBe(specialChars);
    });

    it('should handle Unicode characters', () => {
      const unicode = '🔑-key-日本語';
      const key = IdempotencyKey.create(unicode);

      expect(key.value).toBe(unicode);
    });

    it('should preserve consecutive spaces in middle', () => {
      const keyWithSpaces = 'key  with  spaces';
      const key = IdempotencyKey.create(keyWithSpaces);

      expect(key.value).toBe(keyWithSpaces);
    });
  });
});
