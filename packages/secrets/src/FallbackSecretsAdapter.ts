/* eslint-disable
   @typescript-eslint/no-unsafe-return,
   @typescript-eslint/no-unsafe-call,
   @typescript-eslint/no-unsafe-member-access,
   @typescript-eslint/no-unsafe-argument,
   @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/strict-boolean-expressions
   -- Option is from @acme/kernel; all types correct at compile time but
   unresolvable by ESLint TS plugin due to TypeScript 5.9.x / plugin <5.4. */
import { Option } from '@acme/kernel';
import type { SecretsPort } from './SecretsPort';

/**
 * Decorator that tries a list of `SecretsPort` adapters in order.
 *
 * - **`get`**: returns the first non-empty value; `Option.none()` if all miss.
 * - **`set` / `delete` / `rotate`**: delegates to **every** adapter so all
 *   stores stay in sync.
 *
 * Useful for gradual migrations (primary store + legacy fallback) or
 * multi-region redundancy.
 *
 * @example
 * ```typescript
 * const secrets = new FallbackSecretsAdapter([
 *   new AwsSsmSecretsAdapter(ssmClient, '/prod'),
 *   new EnvSecretsAdapter(),
 * ]);
 * ```
 */
export class FallbackSecretsAdapter implements SecretsPort {
  constructor(private readonly adapters: readonly SecretsPort[]) {
    if (adapters.length === 0) {
      throw new Error('FallbackSecretsAdapter requires at least one adapter');
    }
  }

  async get(key: string): Promise<Option<string>> {
    for (const adapter of this.adapters) {
      const result = await adapter.get(key);
      if (result.isSome()) return result;
    }
    return Option.none<string>();
  }

  async set(key: string, value: string): Promise<void> {
    for (const adapter of this.adapters) {
      await adapter.set(key, value);
    }
  }

  async delete(key: string): Promise<void> {
    for (const adapter of this.adapters) {
      await adapter.delete(key);
    }
  }

  async rotate(key: string): Promise<void> {
    for (const adapter of this.adapters) {
      await adapter.rotate(key);
    }
  }
}
