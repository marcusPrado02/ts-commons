import { ValueObject } from '@acme/kernel';

export class EventName extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(value: string): EventName {
    return new EventName(value);
  }
}

export class EventVersion extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(value: string): EventVersion {
    return new EventVersion(value);
  }
}
