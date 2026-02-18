/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/**
 * ESLint rules disabled for this file because Express types contain 'any'
 * at the framework boundary (req.body, req.query, req.params).
 * This is acceptable as we provide type safety through validation.
 */

import type { Request, NextFunction, RequestHandler } from 'express';

/**
 * Validation error with details
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: ValidationErrorDetail[]
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Individual validation error detail
 */
export interface ValidationErrorDetail {
  readonly field: string;
  readonly message: string;
  readonly value?: unknown;
}

/**
 * Validator function type
 */
export type ValidatorFn<T> = (data: unknown) => ValidationResult<T>;

/**
 * Validation result
 */
export type ValidationResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly errors: ValidationErrorDetail[] };

/**
 * Middleware to validate request body
 *
 * @param validator - Function to validate request body
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { validateBody } from '@acme/web-express';
 *
 * const createUserSchema = z.object({
 *   name: z.string().min(1),
 *   email: z.string().email(),
 * });
 *
 * app.post('/users',
 *   validateBody((data) => {
 *     const result = createUserSchema.safeParse(data);
 *     if (result.success) {
 *       return { success: true, data: result.data };
 *     }
 *     return {
 *       success: false,
 *       errors: result.error.errors.map(e => ({
 *         field: e.path.join('.'),
 *         message: e.message
 *       }))
 *     };
 *   }),
 *   createUserHandler
 * );
 * ```
 */
export function validateBody<T>(validator: ValidatorFn<T>): RequestHandler {
  return (req: Request, _res: unknown, next: NextFunction): void => {
    try {
      const result = validator(req.body);

      if (result.success) {
        // Replace body with validated data
        req.body = result.data;
        next();
      } else {
        // Throw validation error
        throw new ValidationError('Request validation failed', result.errors);
      }
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to validate query parameters
 *
 * @param validator - Function to validate query params
 * @returns Express middleware function
 */
export function validateQuery<T>(validator: ValidatorFn<T>): RequestHandler {
  return (req: Request, _res: unknown, next: NextFunction): void => {
    try {
      const result = validator(req.query);

      if (result.success) {
        req.query = result.data as never; // Type assertion needed for Express types
        next();
      } else {
        throw new ValidationError('Query validation failed', result.errors);
      }
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to validate route parameters
 *
 * @param validator - Function to validate route params
 * @returns Express middleware function
 */
export function validateParams<T>(validator: ValidatorFn<T>): RequestHandler {
  return (req: Request, _res: unknown, next: NextFunction): void => {
    try {
      const result = validator(req.params);

      if (result.success) {
        req.params = result.data as never;
        next();
      } else {
        throw new ValidationError('Path parameters validation failed', result.errors);
      }
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Helper to create validator from Zod schema (if using Zod)
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { createZodValidator, validateBody } from '@acme/web-express';
 *
 * const schema = z.object({ name: z.string() });
 * app.post('/users', validateBody(createZodValidator(schema)), handler);
 * ```
 */
export function createZodValidator<T>(
  schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { errors: Array<{ path: (string | number)[]; message: string }> } } }
): ValidatorFn<T> {
  return (data: unknown): ValidationResult<T> => {
    const result = schema.safeParse(data);

    if (result.success && result.data !== undefined) {
      return { success: true, data: result.data };
    }

    return {
      success: false,
      errors: result.error?.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })) ?? [],
    };
  };
}
