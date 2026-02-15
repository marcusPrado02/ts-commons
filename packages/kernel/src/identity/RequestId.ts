import { ValueObject } from '../ddd/ValueObject';

/**
 * Request ID for tracing individual requests.
 * Generated per request for observability.
 */
export class RequestId extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(value?: string): RequestId {
    const id = value ?? crypto.randomUUID();
    return new RequestId(id);
  }

  static fromString(value: string): RequestId {
    if (!value || value.trim().length === 0) {
      throw new Error('RequestId cannot be empty');
    }
    return new RequestId(value);
  }
}
