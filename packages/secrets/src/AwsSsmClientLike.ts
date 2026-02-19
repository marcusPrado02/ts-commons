/**
 * Structural interfaces for AWS Systems Manager (SSM) Parameter Store.
 *
 * Cast your `@aws-sdk/client-ssm` `SSMClient` instance to `AwsSsmClientLike`
 * to avoid a hard dependency on the AWS SDK inside this library.
 *
 * @example
 * ```typescript
 * import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
 * import type { AwsSsmClientLike } from '@acme/secrets';
 *
 * const ssmClient = new SSMClient({ region: 'us-east-1' });
 * const adapter = new AwsSsmSecretsAdapter(ssmClient as unknown as AwsSsmClientLike);
 * ```
 */

export interface AwsSsmGetParameterParams {
  readonly Name: string;
  readonly WithDecryption?: boolean;
}

export interface AwsSsmGetParameterResult {
  readonly Parameter?: {
    readonly Value?: string;
  };
}

export interface AwsSsmPutParameterParams {
  readonly Name: string;
  readonly Value: string;
  readonly Type?: string;
  readonly Overwrite?: boolean;
}

export interface AwsSsmDeleteParameterParams {
  readonly Name: string;
}

/**
 * Structural interface compatible with `@aws-sdk/client-ssm` `SSMClient`.
 */
export interface AwsSsmClientLike {
  getParameter(params: AwsSsmGetParameterParams): Promise<AwsSsmGetParameterResult>;
  putParameter(params: AwsSsmPutParameterParams): Promise<unknown>;
  deleteParameter(params: AwsSsmDeleteParameterParams): Promise<unknown>;
}
