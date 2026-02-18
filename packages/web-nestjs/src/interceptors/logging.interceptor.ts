/**
 * Logging interceptor for structured request/response logging
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- NestJS framework boundary: request object from getRequest() */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- NestJS framework boundary: request properties */
/* eslint-disable @typescript-eslint/no-unsafe-call -- NestJS framework boundary: logger.info/error methods and Observable operators */
/* eslint-disable @typescript-eslint/consistent-type-imports -- Logger is used by decorator metadata */
import type { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import {
  Injectable,
  Inject,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Logger } from '@acme/observability';

/**
 * Interceptor to log request and response details
 *
 * @example
 * ```typescript
 * @UseInterceptors(LoggingInterceptor)
 * @Controller('users')
 * export class UsersController {
 *   // All requests and responses will be logged
 * }
 * ```
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(@Inject('LOGGER') private readonly logger: Logger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();

    // Extract request info upfront to avoid TypeScript confusion
    const requestMethod = request.method as string;
    const requestUrl = request.url as string;
    const correlationIdValue = request.correlationId?.value as string | undefined;

    this.logger.info('Incoming request', {
      method: requestMethod,
      url: requestUrl,
      correlationId: correlationIdValue,
    });

    return next.handle().pipe(
      tap({
        next: (data: unknown) => {
          const response = context.switchToHttp().getResponse();
          const duration = Date.now() - startTime;

          this.logger.info('Request completed', {
            method: requestMethod,
            url: requestUrl,
            statusCode: response.statusCode as number,
            duration,
            correlationId: correlationIdValue,
            hasBody: data !== undefined && data !== null,
          });
        },
        error: (errorObj: unknown) => {
          const duration = Date.now() - startTime;
          const errorInstance = errorObj instanceof Error ? errorObj : new Error(String(errorObj));

          this.logger.error('Request failed', errorInstance, {
            method: requestMethod,
            url: requestUrl,
            duration,
            correlationId: correlationIdValue,
          });
        },
      })
    );
  }
}
