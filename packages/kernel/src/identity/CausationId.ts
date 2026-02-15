import { ValueObject } from '../ddd/ValueObject';

/**
 * Causation ID for event sourcing.
 * Identifies the message/command that caused this event.
 */
export class CausationId extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(value?: string): CausationId {
    const id = value ?? crypto.randomUUID();
    return new CausationId(id);
  }

  static fromString(value: string): CausationId {
    if (!value || value.trim().length === 0) {
      throw new Error('CausationId cannot be empty');
    }
    return new CausationId(value);
  }
}
