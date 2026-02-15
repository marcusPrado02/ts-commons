import { ValueObject } from '@acme/kernel';

export class Permission extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(value: string): Permission {
    return new Permission(value);
  }
}
