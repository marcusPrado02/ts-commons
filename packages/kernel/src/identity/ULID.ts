import { ValueObject } from '../ddd/ValueObject';

/**
 * ULID (Universally Unique Lexicographically Sortable Identifier).
 * Time-ordered, more performant for databases than UUID.
 */
export class ULID extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  /**
   * Generate a new ULID.
   * NOTE: This is a simplified implementation.
   * Production should use a proper ULID library.
   */
  static generate(): ULID {
    const timestamp = Date.now();
    const randomness = crypto.randomUUID().replace(/-/g, '').substring(0, 16);
    const ulid = timestamp.toString(36).toUpperCase() + randomness.toUpperCase();
    return new ULID(ulid);
  }

  static fromString(value: string): ULID {
    if (!value || value.trim().length === 0) {
      throw new Error('ULID cannot be empty');
    }
    return new ULID(value);
  }
}
