/**
 * Validation pipe for type-safe request validation
 */
/* eslint-disable @typescript-eslint/no-unsafe-call -- NestJS framework boundary: BadRequestException constructor accepts any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- NestJS framework boundary: validator function may return any */
import type { PipeTransform, ArgumentMetadata } from '@nestjs/common';
import { Injectable, BadRequestException } from '@nestjs/common';
import type { Result } from '@acme/kernel';
import { ValidationError } from '@acme/application';

/**
 * Validator function type
 */
export type ValidatorFn<T> = (data: unknown) => Result<T, Error>;

/**
 * Generic validation pipe that uses validator functions
 *
 * @example
 * ```typescript
 * const createUserValidator: ValidatorFn<CreateUserDto> = (data) => {
 *   const dto = data as CreateUserDto;
 *   if (!dto.email.includes('@')) {
 *     return Result.err(new Error('Invalid email'));
 *   }
 *   return Result.ok(dto);
 * };
 *
 * @Post('users')
 * async createUser(
 *   @Body(new ValidationPipe(createUserValidator)) dto: CreateUserDto
 * ) {
 *   // dto is validated
 * }
 * ```
 */
@Injectable()
export class ValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly validator: ValidatorFn<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    const result = this.validator(value);

    return result.match({
      ok: (validated) => validated,
      err: (error) => {
        throw new BadRequestException({
          statusCode: 400,
          message: error.message,
          errors: error instanceof ValidationError ? error.errors : undefined,
        });
      },
    });
  }
}
