/* eslint-disable
   @typescript-eslint/no-unsafe-return,
   @typescript-eslint/no-unsafe-call,
   @typescript-eslint/no-unsafe-member-access,
   @typescript-eslint/no-unsafe-argument
   -- Option is imported from @acme/kernel; static methods (fromNullable) are
   correctly typed at compile time but unresolvable by the ESLint TS plugin due
   to the TypeScript version mismatch (5.9.x vs plugin-supported <5.4). */
import { Option } from '@acme/kernel';
import type { SecretsPort } from './SecretsPort';
import { SecretsRotationNotSupportedError } from './SecretsErrors';

/**
 * Reads secrets from `process.env`.
 *
 * Designed for local development and testing. In production, layer a
 * caching adapter on top of a remote adapter (e.g. `AwsSsmSecretsAdapter`).
 *
 * `set` and `delete` mutate `process.env` at runtime which is useful in tests
 * but should not be used in production server code.
 *
 * `rotate` is not supported — throws `SecretsRotationNotSupportedError`.
 */
export class EnvSecretsAdapter implements SecretsPort {
  get(key: string): Promise<Option<string>> {
    return Promise.resolve(Option.fromNullable(process.env[key]));
  }

  set(key: string, value: string): Promise<void> {
    process.env[key] = value;
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- intentional env-var removal
    delete process.env[key];
    return Promise.resolve();
  }

  rotate(_key: string): Promise<void> {
    return Promise.reject(new SecretsRotationNotSupportedError('EnvSecretsAdapter'));
  }
}
