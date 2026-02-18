/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/**
 * ESLint rules disabled for this file because:
 * 1. Fastify types contain 'any' at the framework boundary (request.body, request.params, request.query)
 * 2. UseCase Result type methods return 'any' at the boundary
 * This is acceptable as we provide type safety through generics and error handling.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { UseCase } from '@acme/application';

/**
 * Route handler type for Fastify
 */
export type FastifyRouteHandler = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<void>;

/**
 * Adapter for Fastify controllers
 *
 * Converts use cases to Fastify route handlers with automatic:
 * - Result type handling (Ok/Err)
 * - HTTP status code mapping
 * - Error propagation to error handler
 *
 * @example
 * ```typescript
 * import { FastifyControllerAdapter } from '@acme/web-fastify';
 *
 * app.post('/users', FastifyControllerAdapter.adaptCreate(createUserUseCase));
 * app.get('/users/:id', FastifyControllerAdapter.adaptQuery(getUserUseCase));
 * ```
 */
export class FastifyControllerAdapter {
  /**
   * Generic adapter for any use case
   * Automatically selects HTTP status based on Result type
   */
  static adapt<TInput, TOutput, TError extends Error>(
    useCase: UseCase<TInput, TOutput, TError>
  ): FastifyRouteHandler {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const result = await useCase.execute(request.body as TInput);

      if (result.isOk() === true) {
        await reply.status(200).send(result.unwrap());
      }
      if (result.isOk() === false) {
        const error = (result as { unwrapErr: () => TError }).unwrapErr();
        throw error;
      }
    };
  }

  /**
   * Adapter for command use cases (mutations)
   * Returns 200 OK on success
   */
  static adaptCommand<TInput, TOutput, TError extends Error>(
    useCase: UseCase<TInput, TOutput, TError>
  ): FastifyRouteHandler {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const result = await useCase.execute(request.body as TInput);

      if (result.isOk() === true) {
        await reply.status(200).send(result.unwrap());
      }
      if (result.isOk() === false) {
        const error = (result as { unwrapErr: () => TError }).unwrapErr();
        throw error;
      }
    };
  }

  /**
   * Adapter for query use cases (read-only)
   * Returns 200 OK with data
   */
  static adaptQuery<TInput, TOutput, TError extends Error>(
    useCase: UseCase<TInput, TOutput, TError>
  ): FastifyRouteHandler {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const input = {
        ...(request.params === undefined ? {} : request.params),
        ...(request.query === undefined ? {} : request.query),
      } as TInput;

      const result = await useCase.execute(input);

      if (result.isOk() === true) {
        await reply.status(200).send(result.unwrap());
      }
      if (result.isOk() === false) {
        const error = (result as { unwrapErr: () => TError }).unwrapErr();
        throw error;
      }
    };
  }

  /**
   * Adapter for creation commands
   * Returns 201 Created on success
   */
  static adaptCreate<TInput, TOutput, TError extends Error>(
    useCase: UseCase<TInput, TOutput, TError>
  ): FastifyRouteHandler {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const result = await useCase.execute(request.body as TInput);

      if (result.isOk() === true) {
        await reply.status(201).send(result.unwrap());
      }
      if (result.isOk() === false) {
        const error = (result as { unwrapErr: () => TError }).unwrapErr();
        throw error;
      }
    };
  }

  /**
   * Adapter for deletion commands
   * Returns 204 No Content on success
   */
  static adaptDelete<TInput, TError extends Error>(
    useCase: UseCase<TInput, void, TError>
  ): FastifyRouteHandler {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const input = {
        ...(request.params === undefined ? {} : request.params),
      } as TInput;

      const result = await useCase.execute(input);

      if (result.isOk() === true) {
        await reply.status(204).send();
      }
      if (result.isOk() === false) {
        const error = (result as { unwrapErr: () => TError }).unwrapErr();
        throw error;
      }
    };
  }
}
