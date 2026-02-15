import { ValueObject } from '@acme/kernel';

/**
 * Idempotency key for ensuring operations are executed only once.
 */
export class IdempotencyKey extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(value: string): IdempotencyKey {
    if (!value || value.trim().length === 0) {
      throw new Error('IdempotencyKey cannot be empty');
    }
    return new IdempotencyKey(value.trim());
  }

  static generate(): IdempotencyKey {
    return new IdempotencyKey(crypto.randomUUID());
  }
}
