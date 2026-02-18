/**
 * Idempotency guard to prevent duplicate request processing
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- NestJS framework boundary: request object from getRequest() */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- NestJS framework boundary: request.headers, request.idempotencyKey */
/* eslint-disable @typescript-eslint/no-unsafe-call -- NestJS framework boundary: context.switchToHttp().getRequest(), IdempotencyKey methods */
/* eslint-disable @typescript-eslint/consistent-type-imports -- IdempotencyStorePort is used by decorator metadata */
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import {
  Injectable,
  Inject,
  ConflictException,
} from '@nestjs/common';
import { IdempotencyStorePort } from '@acme/application';
import { IdempotencyKey } from '@acme/application';

/**
 * Guard to enforce idempotency using idempotency keys
 *
 * @example
 * ```typescript
 * @UseGuards(IdempotencyGuard)
 * @Post('users')
 * async createUser(@Body() dto: CreateUserDto) {
 *   // Request will be deduplicated using Idempotency-Key header
 * }
 * ```
 */
@Injectable()
export class IdempotencyGuard implements CanActivate {
  constructor(
    @Inject('IDEMPOTENCY_STORE')
    private readonly store: IdempotencyStorePort
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Extract idempotency key from header
    const idempotencyKeyHeader = request.headers[
      'idempotency-key'
    ] as string | undefined;

    if (idempotencyKeyHeader === undefined) {
      // No idempotency key, allow request
      return true;
    }

    const idempotencyKey = IdempotencyKey.create(idempotencyKeyHeader);

    // Check if request was already processed
    const existingResult = await this.store.getResult(idempotencyKey);

    if (existingResult !== undefined) {
      // Request already processed, throw conflict
      throw new ConflictException(
        'Request already processed with this idempotency key'
      );
    }

    // Attach idempotency key to request for downstream use
    request.idempotencyKey = idempotencyKey;

    return true;
  }
}
