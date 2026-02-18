import { describe, it, expect, beforeEach } from 'vitest';
import { Result } from '@acme/kernel';
import { InMemoryCommandBus, type Command, type CommandHandler } from '../src';

// Test Commands
class CreateUserCommand implements Command {
  readonly _brand?: 'Command';
  constructor(
    public readonly username: string,
    public readonly email: string,
  ) {}
}

class UpdateUserCommand implements Command {
  readonly _brand?: 'Command';
  constructor(
    public readonly id: string,
    public readonly username: string,
  ) {}
}

class DeleteUserCommand implements Command {
  readonly _brand?: 'Command';
  constructor(public readonly id: string) {}
}

// Test Command Handlers
class CreateUserHandler implements CommandHandler<CreateUserCommand, string, Error> {
  handle(command: CreateUserCommand): Promise<Result<string, Error>> {
    if (!command.email.includes('@')) {
      return Promise.resolve(Result.err(new Error('Invalid email')));
    }
    return Promise.resolve(Result.ok(`user-${command.username}`));
  }
}

class UpdateUserHandler implements CommandHandler<UpdateUserCommand, void, Error> {
  handle(command: UpdateUserCommand): Promise<Result<void, Error>> {
    if (!command.id) {
      return Promise.resolve(Result.err(new Error('User ID is required')));
    }
    return Promise.resolve(Result.ok(undefined));
  }
}

class DeleteUserHandler implements CommandHandler<DeleteUserCommand, boolean, Error> {
  handle(command: DeleteUserCommand): Promise<Result<boolean, Error>> {
    if (command.id === 'protected') {
      return Promise.resolve(Result.err(new Error('Cannot delete protected user')));
    }
    return Promise.resolve(Result.ok(true));
  }
}

describe('InMemoryCommandBus', () => {
  let commandBus: InMemoryCommandBus;

  beforeEach(() => {
    commandBus = new InMemoryCommandBus();
  });

  describe('register', () => {
    it('should register a command handler', () => {
      expect(() => {
        commandBus.register(CreateUserCommand, new CreateUserHandler());
      }).not.toThrow();
    });

    it('should allow registering multiple handlers', () => {
      commandBus.register(CreateUserCommand, new CreateUserHandler());
      commandBus.register(UpdateUserCommand, new UpdateUserHandler());
      commandBus.register(DeleteUserCommand, new DeleteUserHandler());

      expect(commandBus).toBeDefined();
    });

    it('should allow overriding a handler', () => {
      commandBus.register(CreateUserCommand, new CreateUserHandler());

      // Override with a new handler
      const newHandler = new CreateUserHandler();
      expect(() => {
        commandBus.register(CreateUserCommand, newHandler);
      }).not.toThrow();
    });
  });

  describe('dispatch', () => {
    it('should dispatch a command to its handler', async () => {
      commandBus.register(CreateUserCommand, new CreateUserHandler());

      const command = new CreateUserCommand('john', 'john@example.com');
      const result = await commandBus.dispatch(command);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('user-john');
    });

    it('should handle command execution errors', async () => {
      commandBus.register(CreateUserCommand, new CreateUserHandler());

      const command = new CreateUserCommand('john', 'invalid-email');
      const result = await commandBus.dispatch(command);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toBe('Invalid email');
    });

    it('should throw when dispatching unregistered command', async () => {
      const command = new CreateUserCommand('john', 'john@example.com');

      await expect(commandBus.dispatch(command)).rejects.toThrow(
        'No handler registered for command: CreateUserCommand'
      );
    });

    it('should dispatch different command types correctly', async () => {
      commandBus.register(CreateUserCommand, new CreateUserHandler());
      commandBus.register(UpdateUserCommand, new UpdateUserHandler());
      commandBus.register(DeleteUserCommand, new DeleteUserHandler());

      // Create
      const createResult = await commandBus.dispatch(
        new CreateUserCommand('alice', 'alice@example.com')
      );
      expect(createResult.isOk()).toBe(true);
      expect(createResult.unwrap()).toBe('user-alice');

      // Update
      const updateResult = await commandBus.dispatch(
        new UpdateUserCommand('123', 'alice-updated')
      );
      expect(updateResult.isOk()).toBe(true);

      // Delete
      const deleteResult = await commandBus.dispatch(
        new DeleteUserCommand('123')
      );
      expect(deleteResult.isOk()).toBe(true);
      expect(deleteResult.unwrap()).toBe(true);
    });

    it('should handle complex error scenarios', async () => {
      commandBus.register(UpdateUserCommand, new UpdateUserHandler());
      commandBus.register(DeleteUserCommand, new DeleteUserHandler());

      // Update with missing ID
      const updateResult = await commandBus.dispatch(
        new UpdateUserCommand('', 'username')
      );
      expect(updateResult.isErr()).toBe(true);
      expect(updateResult.unwrapErr().message).toBe('User ID is required');

      // Delete protected user
      const deleteResult = await commandBus.dispatch(
        new DeleteUserCommand('protected')
      );
      expect(deleteResult.isErr()).toBe(true);
      expect(deleteResult.unwrapErr().message).toBe('Cannot delete protected user');
    });

    it('should maintain handler isolation', async () => {
      let createCount = 0;
      let updateCount = 0;

      class CountingCreateHandler implements CommandHandler<CreateUserCommand, string, Error> {
        handle(_command: CreateUserCommand): Promise<Result<string, Error>> {
          createCount++;
          return Promise.resolve(Result.ok(`user-${createCount}`));
        }
      }

      class CountingUpdateHandler implements CommandHandler<UpdateUserCommand, void, Error> {
        handle(_command: UpdateUserCommand): Promise<Result<void, Error>> {
          updateCount++;
          return Promise.resolve(Result.ok(undefined));
        }
      }

      commandBus.register(CreateUserCommand, new CountingCreateHandler());
      commandBus.register(UpdateUserCommand, new CountingUpdateHandler());

      await commandBus.dispatch(new CreateUserCommand('user1', 'user1@test.com'));
      await commandBus.dispatch(new CreateUserCommand('user2', 'user2@test.com'));
      await commandBus.dispatch(new UpdateUserCommand('1', 'updated'));

      expect(createCount).toBe(2);
      expect(updateCount).toBe(1);
    });

    it('should handle async operations correctly', async () => {
      class AsyncCreateHandler implements CommandHandler<CreateUserCommand, string, Error> {
        async handle(command: CreateUserCommand): Promise<Result<string, Error>> {
          // Simulate async operation
          await new Promise(resolve => setTimeout(resolve, 10));
          return Result.ok(`async-user-${command.username}`);
        }
      }

      commandBus.register(CreateUserCommand, new AsyncCreateHandler());

      const result = await commandBus.dispatch(
        new CreateUserCommand('async', 'async@test.com')
      );

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('async-user-async');
    });
  });

  describe('edge cases', () => {
    it('should handle empty command data', async () => {
      class EmptyCommand implements Command {
        readonly _brand?: 'Command';
      }

      class EmptyHandler implements CommandHandler<EmptyCommand, void, Error> {
        handle(_command: EmptyCommand): Promise<Result<void, Error>> {
          return Promise.resolve(Result.ok(undefined));
        }
      }

      commandBus.register(EmptyCommand, new EmptyHandler());

      const result = await commandBus.dispatch(new EmptyCommand());
      expect(result.isOk()).toBe(true);
    });

    it('should handle commands with complex data types', async () => {
      interface UserData {
        profile: {
          firstName: string;
          lastName: string;
        };
        settings: Map<string, unknown>;
      }

      class ComplexCommand implements Command {
        readonly _brand?: 'Command';
        constructor(public readonly data: UserData) {}
      }

      class ComplexHandler implements CommandHandler<ComplexCommand, UserData, Error> {
        handle(command: ComplexCommand): Promise<Result<UserData, Error>> {
          return Promise.resolve(Result.ok(command.data));
        }
      }

      commandBus.register(ComplexCommand, new ComplexHandler());

      const data: UserData = {
        profile: { firstName: 'John', lastName: 'Doe' },
        settings: new Map([['theme', 'dark']]),
      };

      const result = await commandBus.dispatch(new ComplexCommand(data));

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual(data);
    });
  });
});
