import type { Result } from '@acme/kernel';
import type { Command } from './Command';
import type { CommandHandler } from './CommandHandler';

/**
 * Command constructor type that can be concrete or abstract
 */
export type CommandConstructor<TCommand extends Command = Command> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | (new (...args: any[]) => TCommand)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | (abstract new (...args: any[]) => TCommand);

/**
 * Command bus for dispatching commands to handlers.
 */
export interface CommandBus {
  dispatch<TCommand extends Command, TResult = void, TError = Error>(
    command: TCommand,
  ): Promise<Result<TResult, TError>>;

  register<TCommand extends Command, TResult = void, TError = Error>(
    commandType: CommandConstructor<TCommand>,
    handler: CommandHandler<TCommand, TResult, TError>,
  ): void;
}

/**
 * Simple in-memory command bus implementation.
 */
export class InMemoryCommandBus implements CommandBus {
  private readonly handlers = new Map<string, CommandHandler<Command, unknown, Error>>();

  register<TCommand extends Command, TResult = void, TError = Error>(
    commandType: CommandConstructor<TCommand>,
    handler: CommandHandler<TCommand, TResult, TError>,
  ): void {
    this.handlers.set(commandType.name, handler as CommandHandler<Command, unknown, Error>);
  }

  async dispatch<TCommand extends Command, TResult = void, TError = Error>(
    command: TCommand,
  ): Promise<Result<TResult, TError>> {
    const handler = this.handlers.get(command.constructor.name);
    if (!handler) {
      throw new Error(`No handler registered for command: ${command.constructor.name}`);
    }
    return handler.handle(command) as Promise<Result<TResult, TError>>;
  }
}
