import { ValueObject } from '../ddd/ValueObject';

/**
 * UUID (Universally Unique Identifier).
 */
export class UUID extends ValueObject<string> {
  private static readonly UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  private constructor(value: string) {
    super(value);
  }

  static generate(): UUID {
    return new UUID(crypto.randomUUID());
  }

  static fromString(value: string): UUID {
    if (!value || !UUID.UUID_REGEX.test(value)) {
      throw new Error(`Invalid UUID: ${value}`);
    }
    return new UUID(value);
  }

  static isValid(value: string): boolean {
    return UUID.UUID_REGEX.test(value);
  }
}
