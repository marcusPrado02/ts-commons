/* eslint-disable
   @typescript-eslint/no-unsafe-return,
   @typescript-eslint/no-unsafe-call,
   @typescript-eslint/no-unsafe-member-access,
   @typescript-eslint/no-unsafe-argument
   -- Option is from @acme/kernel; all types correct at compile time but
   unresolvable by ESLint TS plugin due to TypeScript 5.9.x / plugin <5.4. */
import { Option } from '@acme/kernel';
import type { AwsSsmClientLike } from './AwsSsmClientLike';
import type { SecretsPort } from './SecretsPort';
import { SecretsRotationNotSupportedError } from './SecretsErrors';

/**
 * Secrets adapter backed by AWS SSM Parameter Store.
 *
 * Uses structural `AwsSsmClientLike` — no direct dependency on `@aws-sdk/client-ssm`.
 *
 * @example
 * ```typescript
 * import { SSMClient } from '@aws-sdk/client-ssm';
 * import type { AwsSsmClientLike } from '@acme/secrets';
 *
 * const adapter = new AwsSsmSecretsAdapter(
 *   new SSMClient({ region: 'us-east-1' }) as unknown as AwsSsmClientLike,
 *   '/myapp/prod',
 * );
 * ```
 */
export class AwsSsmSecretsAdapter implements SecretsPort {
  constructor(
    private readonly client: AwsSsmClientLike,
    private readonly prefix: string = '',
  ) {}

  private fullName(key: string): string {
    return this.prefix.length > 0 ? `${this.prefix}/${key}` : key;
  }

  async get(key: string): Promise<Option<string>> {
    try {
      const response = await this.client.getParameter({
        Name:            this.fullName(key),
        WithDecryption:  true,
      });
      return Option.fromNullable(response.Parameter?.Value ?? null);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'ParameterNotFound') {
        return Option.none<string>();
      }
      throw err;
    }
  }

  async set(key: string, value: string): Promise<void> {
    await this.client.putParameter({
      Name:      this.fullName(key),
      Value:     value,
      Type:      'SecureString',
      Overwrite: true,
    });
  }

  async delete(key: string): Promise<void> {
    await this.client.deleteParameter({ Name: this.fullName(key) });
  }

  rotate(_key: string): Promise<void> {
    return Promise.reject(new SecretsRotationNotSupportedError('AwsSsmSecretsAdapter'));
  }
}
