/**
 * Generic fluent builder for constructing test objects.
 *
 * @example
 * ```typescript
 * interface UserDto { name: string; age: number; role: string }
 * const builder = new Builder<UserDto>({ name: 'Alice', age: 30, role: 'user' });
 * const admin = builder.with('role', 'admin').build();
 * ```
 */
export class Builder<T extends object> {
  private readonly fields: Partial<T>;

  constructor(defaults: Partial<T> = {}) {
    this.fields = { ...defaults };
  }

  /**
   * Sets a single field and returns the builder for chaining.
   */
  with<K extends keyof T>(key: K, value: T[K]): this {
    this.fields[key] = value;
    return this;
  }

  /**
   * Builds the final object, optionally applying one-off overrides.
   */
  build(overrides: Partial<T> = {}): T {
    return { ...this.fields, ...overrides } as T;
  }

  /**
   * Builds `count` independent copies of the object.
   */
  buildMany(count: number, overrides: Partial<T> = {}): T[] {
    return Array.from({ length: count }, () => this.build(overrides));
  }
}
