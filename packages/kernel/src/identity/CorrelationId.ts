import { ValueObject } from '../ddd/ValueObject';

/**
 * Correlation ID for tracking requests across services.
 * Should be generated once at the edge and propagated.
 */
export class CorrelationId extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(value?: string): CorrelationId {
    const id = value ?? crypto.randomUUID();
    return new CorrelationId(id);
  }

  static fromString(value: string): CorrelationId {
    if (!value || value.trim().length === 0) {
      throw new Error('CorrelationId cannot be empty');
    }
    return new CorrelationId(value);
  }
}
