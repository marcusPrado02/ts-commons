import { ValueObject } from '../ddd/ValueObject';

/**
 * Tenant identifier for multi-tenant systems.
 */
export class TenantId extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(value: string): TenantId {
    if (!value || value.trim().length === 0) {
      throw new Error('TenantId cannot be empty');
    }
    return new TenantId(value.trim());
  }

  static fromString(value: string): TenantId {
    return this.create(value);
  }
}
