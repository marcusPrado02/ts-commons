/**
 * Error mapping interceptor to convert errors to Problem Details RFC 7807
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- NestJS framework boundary: request/response from getRequest/getResponse */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- NestJS framework boundary: request.url, response.status, response.json */
/* eslint-disable @typescript-eslint/no-unsafe-call -- NestJS framework boundary: response.status().json() */
/* eslint-disable @typescript-eslint/no-unsafe-return -- NestJS framework boundary: throwError returns any */
import type { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import {
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type { ProblemDetails } from '@acme/errors';

/**
 * Interceptor to map errors to Problem Details format
 *
 * @example
 * ```typescript
 * @UseInterceptors(ErrorMappingInterceptor)
 * @Controller('users')
 * export class UsersController {
 *   // Errors will be converted to Problem Details
 * }
 * ```
 */
@Injectable()
export class ErrorMappingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: Error) => {
        const response = context.switchToHttp().getResponse();
        const request = context.switchToHttp().getRequest();

        let problemDetails: ProblemDetails;
        let statusCode: number;

        if (error instanceof HttpException) {
          statusCode = error.getStatus();
          problemDetails = {
            type: 'https://api.example.com/errors/http-error',
            title: error.message,
            status: statusCode,
            detail: error.message,
            instance: request.url,
          };
        } else if (error.name === 'ValidationError') {
          statusCode = HttpStatus.BAD_REQUEST;
          problemDetails = {
            type: 'https://api.example.com/errors/validation-error',
            title: 'Validation Failed',
            status: statusCode,
            detail: error.message,
            instance: request.url,
          };
        } else {
          statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
          problemDetails = {
            type: 'https://api.example.com/errors/internal-error',
            title: 'Internal Server Error',
            status: statusCode,
            detail: error.message,
            instance: request.url,
          };
        }

        response.status(statusCode).json(problemDetails);

        return throwError(() => error);
      })
    );
  }
}
