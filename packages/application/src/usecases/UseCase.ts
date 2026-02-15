import type { Result } from '@acme/kernel';

/**
 * Use case interface for application layer operations.
 */
export interface UseCase<TInput, TOutput, TError = Error> {
  execute(input: TInput): Promise<Result<TOutput, TError>>;
}
