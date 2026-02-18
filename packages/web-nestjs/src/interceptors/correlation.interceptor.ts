/**
 * Correlation interceptor for request tracking
 * Generates or extracts correlation IDs from requests
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- NestJS framework boundary: request/response from getRequest/getResponse */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- NestJS framework boundary: request.headers, request.correlationId, response.setHeader */
/* eslint-disable @typescript-eslint/no-unsafe-call -- NestJS framework boundary: response.setHeader() */
import type { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { CorrelationId } from '@acme/kernel';
import { UUID } from '@acme/kernel';

/**
 * Interceptor to handle correlation ID generation and propagation
 *
 * @example
 * ```typescript
 * @UseInterceptors(CorrelationInterceptor)
 * @Controller('users')
 * export class UsersController {
 *   // All requests will have correlation ID
 * }
 * ```
 */
@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Extract or generate correlation ID
    const correlationIdHeader = request.headers['x-correlation-id'] as
      | string
      | undefined;

    let correlationId: CorrelationId;
    if (correlationIdHeader !== undefined) {
      correlationId = UUID.fromString(correlationIdHeader);
    } else {
      correlationId = UUID.generate();
    }

    // Attach to request for downstream use
    request.correlationId = correlationId;

    // Set response header
    response.setHeader('x-correlation-id', correlationId.value);

    return next.handle().pipe(
      tap(() => {
        // Additional logic after response
      })
    );
  }
}
