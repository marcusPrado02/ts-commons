/**
 * Decorators for NestJS integration with CQRS patterns
 */
/* eslint-disable @typescript-eslint/no-unsafe-return -- NestJS framework boundary: SetMetadata returns any */
/* eslint-disable @typescript-eslint/no-unsafe-call -- NestJS framework boundary: SetMetadata is any-typed */
import { SetMetadata } from '@nestjs/common';

/**
 * Metadata keys for decorators
 */
export const USE_CASE_METADATA = 'use_case';
export const COMMAND_HANDLER_METADATA = 'command_handler';
export const QUERY_HANDLER_METADATA = 'query_handler';

/**
 * Mark a controller or handler as a use case
 *
 * @param name - Name of the use case for logging and tracing
 * @example
 * ```typescript
 * @UseCase('CreateUser')
 * @Controller('users')
 * export class CreateUserController {
 *   // ...
 * }
 * ```
 */
export const UseCase = (name: string): MethodDecorator & ClassDecorator => {
  return SetMetadata(USE_CASE_METADATA, name);
};

/**
 * Mark a handler as a command handler
 *
 * @param commandName - Name of the command this handler processes
 * @example
 * ```typescript
 * @CommandHandler('CreateUserCommand')
 * export class CreateUserHandler {
 *   async execute(command: CreateUserCommand): Promise<Result<void>> {
 *     // ...
 *   }
 * }
 * ```
 */
export const CommandHandler = (
  commandName: string
): ClassDecorator & MethodDecorator => {
  return SetMetadata(COMMAND_HANDLER_METADATA, commandName);
};

/**
 * Mark a handler as a query handler
 *
 * @param queryName - Name of the query this handler processes
 * @example
 * ```typescript
 * @QueryHandler('GetUserQuery')
 * export class GetUserHandler {
 *   async execute(query: GetUserQuery): Promise<Result<UserDto>> {
 *     // ...
 *   }
 * }
 * ```
 */
export const QueryHandler = (
  queryName: string
): ClassDecorator & MethodDecorator => {
  return SetMetadata(QUERY_HANDLER_METADATA, queryName);
};
