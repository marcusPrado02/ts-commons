import type { Result } from '@acme/kernel';
import type { Command } from './Command';

/**
 * Handler for executing commands.
 */
export interface CommandHandler<TCommand extends Command, TResult = void, TError = Error> {
  handle(command: TCommand): Promise<Result<TResult, TError>>;
}
