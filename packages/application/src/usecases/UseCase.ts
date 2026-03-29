import type { Result } from '@marcusprado02/kernel';

/**
 * Use case interface for application layer operations.
 */
export interface UseCase<TInput, TOutput, TError = Error> {
  execute(input: TInput): Promise<Result<TOutput, TError>>;
}
