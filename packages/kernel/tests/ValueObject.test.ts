import { describe, it, expect } from 'vitest';
import { ValueObject } from '../src/ddd/ValueObject';

// Test implementation
class Email extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(email: string): Email {
    // Simple validation for test purposes
    if (!email.includes('@')) {
      throw new Error('Invalid email');
    }
    return new Email(email);
  }
}

class UserId extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(id: string): UserId {
    return new UserId(id);
  }
}

class Money extends ValueObject<{ amount: number; currency: string }> {
  private constructor(value: { amount: number; currency: string }) {
    super(value);
  }

  static create(amount: number, currency: string): Money {
    return new Money({ amount, currency });
  }

  protected override compareTo(otherValue: { amount: number; currency: string }): boolean {
    return (
      this._value.amount === otherValue.amount &&
      this._value.currency === otherValue.currency
    );
  }
}

describe('ValueObject', () => {
  describe('creation and immutability', () => {
    it('should create a value object', () => {
      const email = Email.create('test@example.com');

      expect(email.value).toBe('test@example.com');
    });

    it('should be frozen (immutable)', () => {
      const email = Email.create('test@example.com');

      expect(Object.isFrozen(email)).toBe(true);
    });

    it('should throw for invalid values', () => {
      expect(() => Email.create('invalid')).toThrow('Invalid email');
    });
  });

  describe('equals', () => {
    it('should return true for equal primitive values', () => {
      const email1 = Email.create('test@example.com');
      const email2 = Email.create('test@example.com');

      expect(email1.equals(email2)).toBe(true);
    });

    it('should return false for different primitive values', () => {
      const email1 = Email.create('test1@example.com');
      const email2 = Email.create('test2@example.com');

      expect(email1.equals(email2)).toBe(false);
    });

    it('should return false for different types', () => {
      const email = Email.create('test@example.com');
      const userId = UserId.create('different-id');

      expect(email.equals(userId as unknown as ValueObject<string>)).toBe(false);
    });

    it('should work with object values', () => {
      const money1 = Money.create(100, 'USD');
      const money2 = Money.create(100, 'USD');
      const money3 = Money.create(100, 'EUR');

      expect(money1.equals(money2)).toBe(true);
      expect(money1.equals(money3)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return string representation', () => {
      const email = Email.create('test@example.com');
      expect(email.toString()).toBe('test@example.com');
    });

    it('should work with complex values', () => {
      const money = Money.create(100, 'USD');
      expect(money.toString()).toBe('[object Object]');
    });
  });

  describe('value accessor', () => {
    it('should return the underlying value', () => {
      const email = Email.create('test@example.com');
      expect(email.value).toBe('test@example.com');
    });

    it('should return complex values', () => {
      const money = Money.create(100, 'USD');
      expect(money.value).toEqual({ amount: 100, currency: 'USD' });
    });
  });
});
