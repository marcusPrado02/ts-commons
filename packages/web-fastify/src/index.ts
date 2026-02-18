/**
 * @acme/web-fastify
 *
 * Fastify adapter for ts-commons platform
 *
 * Provides hooks, adapters, and utilities for integrating Fastify
 * with Clean Architecture use cases following hexagonal architecture principles.
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import {
 *   correlationHook,
 *   errorHandlerHook,
 *   loggingHook,
 *   FastifyControllerAdapter
 * } from '@acme/web-fastify';
 *
 * const app = Fastify();
 *
 * // Register hooks
 * app.addHook('onRequest', correlationHook());
 * app.addHook('onRequest', loggingHook(logger));
 * app.setErrorHandler(errorHandlerHook(logger));
 *
 * // Adapt use cases to routes
 * app.post('/users', FastifyControllerAdapter.adaptCreate(createUserUseCase));
 * app.get('/users/:id', FastifyControllerAdapter.adaptQuery(getUserUseCase));
 * ```
 */

// Hooks
export { correlationHook, correlationHookCallback } from './hooks/CorrelationHook';
export { errorHandlerHook } from './hooks/ErrorHandlerHook';
export { loggingHook, loggingHookCallback } from './hooks/LoggingHook';
export type { LoggingHookOptions } from './hooks/LoggingHook';

// Adapters
export { FastifyControllerAdapter } from './adapters/FastifyControllerAdapter';
export type { FastifyRouteHandler } from './adapters/FastifyControllerAdapter';
export { FastifyContextAdapter } from './adapters/FastifyContextAdapter';
export type { FastifyUserContext } from './adapters/FastifyContextAdapter';
