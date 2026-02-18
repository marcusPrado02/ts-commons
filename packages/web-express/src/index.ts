/**
 * @acme/web-express
 *
 * Express.js adapter for ts-commons platform
 * Provides middleware, adapters, and utilities for integrating Express.js
 * with Clean Architecture patterns.
 *
 * @packageDocumentation
 */

// Middleware exports
export {
  correlationMiddleware,
} from './middleware/CorrelationMiddleware.js';

export {
  errorHandlerMiddleware,
  registerErrorHandler,
} from './middleware/ErrorHandlerMiddleware.js';

export {
  loggingMiddleware,
  advancedLoggingMiddleware,
  type LoggingOptions,
} from './middleware/LoggingMiddleware.js';

export {
  validateBody,
  validateQuery,
  validateParams,
  createZodValidator,
  ValidationError,
  type ValidationErrorDetail,
  type ValidatorFn,
  type ValidationResult,
} from './middleware/ValidationMiddleware.js';

// Adapter exports
export {
  ExpressControllerAdapter,
  adaptUseCase,
  type ControllerAdapterOptions,
} from './adapters/ExpressControllerAdapter.js';

export {
  ExpressContextAdapter,
  extractUserFromJWT,
  type ExpressUserContext,
} from './adapters/ExpressContextAdapter.js';

// Re-export Express types for convenience
export type {
  Request,
  Response,
  NextFunction,
  RequestHandler,
  ErrorRequestHandler,
  Application,
} from 'express';
