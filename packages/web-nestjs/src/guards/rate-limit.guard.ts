/**
 * Rate limit guard to prevent abuse
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- NestJS framework boundary: request object from getRequest() */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- NestJS framework boundary: request object */
/* eslint-disable @typescript-eslint/no-unsafe-call -- NestJS framework boundary: context.switchToHttp().getRequest() */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- NestJS framework boundary: HttpStatus.TOO_MANY_REQUESTS */
/* eslint-disable @typescript-eslint/require-await -- Guard interface requires async */
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import {
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Guard to enforce rate limiting per IP or user
 *
 * @example
 * ```typescript
 * @UseGuards(RateLimitGuard)
 * @Post('users')
 * async createUser(@Body() dto: CreateUserDto) {
 *   // Request will be rate limited
 * }
 * ```
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly store = new Map<string, RateLimitEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(options: { maxRequests?: number; windowMs?: number } = {}) {
    this.maxRequests = options.maxRequests ?? 100;
    this.windowMs = options.windowMs ?? 60000; // 1 minute
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const key = this.getKey(request);

    const now = Date.now();
    const entry = this.store.get(key);

    if (entry === undefined || now > entry.resetTime) {
      // New window
      this.store.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    entry.count++;
    return true;
  }

  private getKey(request: { ip?: string; user?: { id: string } }): string {
    // Use user ID if authenticated, otherwise IP
    return request.user?.id ?? request.ip ?? 'unknown';
  }
}
