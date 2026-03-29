import { ValueObject } from '@marcusprado02/kernel';

export class Permission extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(value: string): Permission {
    return new Permission(value);
  }
}
