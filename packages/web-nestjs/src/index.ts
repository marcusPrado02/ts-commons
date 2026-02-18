/**
 * @acme/web-nestjs - NestJS adapter for TypeScript Commons Platform
 *
 * Deep integration with NestJS providing modules, decorators, interceptors,
 * guards and pipes for Clean Architecture and CQRS patterns.
 *
 * @packageDocumentation
 */

// Modules
export { CommonsCoreModule } from './modules/CommonsCoreModule.js';
export type { CommonsCoreModuleOptions } from './modules/CommonsCoreModule.js';

export { CommonsObservabilityModule } from './modules/CommonsObservabilityModule.js';
export type { CommonsObservabilityModuleOptions } from './modules/CommonsObservabilityModule.js';

export { CommonsResilienceModule } from './modules/CommonsResilienceModule.js';
export type { CommonsResilienceModuleOptions } from './modules/CommonsResilienceModule.js';

export { CommonsOutboxModule } from './modules/CommonsOutboxModule.js';
export type { CommonsOutboxModuleOptions } from './modules/CommonsOutboxModule.js';

// Decorators
export {
  UseCase,
  CommandHandler,
  QueryHandler,
  USE_CASE_METADATA,
  COMMAND_HANDLER_METADATA,
  QUERY_HANDLER_METADATA,
} from './decorators/use-case.decorator.js';

// Interceptors
export { CorrelationInterceptor } from './interceptors/correlation.interceptor.js';
export { LoggingInterceptor } from './interceptors/logging.interceptor.js';
export { ErrorMappingInterceptor } from './interceptors/error-mapping.interceptor.js';

// Guards
export { IdempotencyGuard } from './guards/idempotency.guard.js';
export { RateLimitGuard } from './guards/rate-limit.guard.js';

// Pipes
export { ValidationPipe } from './pipes/validation.pipe.js';
export type { ValidatorFn } from './pipes/validation.pipe.js';
