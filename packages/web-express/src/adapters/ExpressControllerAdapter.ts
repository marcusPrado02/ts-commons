/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/**
 * ESLint rules disabled for this file because Express types contain 'any'
 * at the framework boundary. This is acceptable as we provide type safety
 * at the application layer above.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { UseCase } from '@acme/application';
import type { Result } from '@acme/kernel';

/**
 * Options for controller adapter
 */
export interface ControllerAdapterOptions {
  /**
   * HTTP status code for successful responses (default: 200)
   */
  readonly successStatus?: number;

  /**
   * Function to extract input from request
   */
  readonly extractInput?: (req: Request) => unknown;

  /**
   * Function to transform output before sending
   */
  readonly transformOutput?: (output: unknown) => unknown;
}

/**
 * Adapter to convert Express request handlers to use case executions
 *
 * This adapter bridges Express.js controllers with Clean Architecture use cases,
 * handling Result types and error propagation automatically.
 *
 * @param useCase - Use case to execute
 * @param options - Adapter configuration options
 * @returns Express request handler
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { ExpressControllerAdapter } from '@acme/web-express';
 * import { CreateUserUseCase } from './usecases';
 *
 * const app = express();
 * const createUserUseCase = new CreateUserUseCase();
 *
 * app.post('/users',
 *   ExpressControllerAdapter.adapt(createUserUseCase, {
 *     successStatus: 201,
 *     extractInput: (req) => req.body
 *   })
 * );
 * ```
 */
export class ExpressControllerAdapter {
  /**
   * Adapt a use case to Express request handler
   */
  static adapt<TInput, TOutput, TError extends Error>(
    useCase: UseCase<TInput, TOutput, TError>,
    options: ControllerAdapterOptions = {},
  ): RequestHandler {
    const {
      successStatus = 200,
      extractInput = (req: Request): unknown => req.body,
      transformOutput = (output: unknown): unknown => output,
    } = options;

    return (req: Request, res: Response, next: NextFunction): void => {
      void (async (): Promise<void> => {
        try {
          // Extract input from request
          const input = extractInput(req) as TInput;

          // Execute use case
          const result: Result<TOutput, TError> = await useCase.execute(input);

          // Handle result
          if (result.isOk() === true) {
            const output: TOutput = result.unwrap();
            const transformed: unknown = transformOutput(output);
            void res.status(successStatus).json(transformed);
          }

          if (result.isErr() === true) {
            // Pass error to error handler middleware
            const error: TError = result.unwrapErr();
            next(error);
          }
        } catch (error: unknown) {
          // Catch unexpected errors
          next(error);
        }
      })();
    };
  }

  /**
   * Adapt a use case with void return (e.g., commands)
   */
  static adaptCommand<TInput, TError extends Error>(
    useCase: UseCase<TInput, void, TError>,
    options: Omit<ControllerAdapterOptions, 'transformOutput'> = {},
  ): RequestHandler {
    return ExpressControllerAdapter.adapt(useCase, {
      ...options,
      successStatus: options.successStatus ?? 204, // No Content for commands
      transformOutput: () => undefined,
    });
  }

  /**
   * Adapt a use case for GET requests (queries)
   */
  static adaptQuery<TInput, TOutput, TError extends Error>(
    useCase: UseCase<TInput, TOutput, TError>,
    options: ControllerAdapterOptions = {},
  ): RequestHandler {
    return ExpressControllerAdapter.adapt(useCase, {
      ...options,
      extractInput:
        options.extractInput ??
        ((req: Request): unknown => ({
          ...req.params,
          ...req.query,
        })),
    });
  }

  /**
   * Adapt a use case for creation (POST) requests
   */
  static adaptCreate<TInput, TOutput, TError extends Error>(
    useCase: UseCase<TInput, TOutput, TError>,
    options: ControllerAdapterOptions = {},
  ): RequestHandler {
    return ExpressControllerAdapter.adapt(useCase, {
      ...options,
      successStatus: 201, // Created
    });
  }

  /**
   * Adapt a use case for deletion (DELETE) requests
   */
  static adaptDelete<TInput, TError extends Error>(
    useCase: UseCase<TInput, void, TError>,
    options: Omit<ControllerAdapterOptions, 'transformOutput'> = {},
  ): RequestHandler {
    return ExpressControllerAdapter.adaptCommand(useCase, {
      ...options,
      successStatus: 204, // No Content
    });
  }
}

/**
 * Helper function for quick adaptation
 *
 * @example
 * ```typescript
 * app.post('/users', adaptUseCase(createUserUseCase));
 * app.get('/users/:id', adaptUseCase(getUserUseCase, { extractInput: req => req.params }));
 * ```
 */
export function adaptUseCase<TInput, TOutput, TError extends Error>(
  useCase: UseCase<TInput, TOutput, TError>,
  options?: ControllerAdapterOptions,
): RequestHandler {
  return ExpressControllerAdapter.adapt(useCase, options);
}
