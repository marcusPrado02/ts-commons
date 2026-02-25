// Mediator pattern avançado
export type {
  MediatorRequest,
  RequestHandler,
  PipelineBehavior,
  PreProcessor,
  PostProcessor,
  MediatorLogEntry,
  CacheEntry,
} from './mediator/index.js';
export { Mediator } from './mediator/index.js';
export { LoggingBehavior } from './mediator/index.js';
export { ValidationBehavior, MediatorValidationError } from './mediator/index.js';
export { CachingBehavior } from './mediator/index.js';

// CQRS – Read model projections (CQRS avançado)
export type {
  ProjectedEvent,
  ReadModel,
  ReadModelStore,
  Snapshot,
  SnapshotStore,
  RebuildResult,
  ProjectionConsistencyStats,
  ConsistencyReport,
} from './cqrs/readmodel/index.js';
export type { Projection } from './cqrs/readmodel/index.js';
export { BaseProjection } from './cqrs/readmodel/index.js';
export { InMemoryReadModelStore } from './cqrs/readmodel/index.js';
export { ProjectionRebuildManager } from './cqrs/readmodel/index.js';
export { ConsistencyMonitor } from './cqrs/readmodel/index.js';
export { InMemorySnapshotStore, shouldTakeSnapshot } from './cqrs/readmodel/index.js';

// CQRS
export type { Command } from './cqrs/Command';
export { BaseCommand } from './cqrs/Command';
export type { CommandHandler } from './cqrs/CommandHandler';
export type { CommandBus, CommandConstructor } from './cqrs/CommandBus';
export { InMemoryCommandBus } from './cqrs/CommandBus';
export type { Query } from './cqrs/Query';
export { BaseQuery } from './cqrs/Query';
export type { QueryHandler } from './cqrs/QueryHandler';
export type { QueryBus, QueryConstructor } from './cqrs/QueryBus';
export { InMemoryQueryBus } from './cqrs/QueryBus';

// Use Cases
export type { UseCase } from './usecases/UseCase';
export type { UseCaseContext } from './usecases/UseCaseContext';

// Validation
export type { Validator } from './validation/Validator';
export { ValidationError } from './validation/ValidationError';
export type { ValidationFieldError } from './validation/ValidationError';

// Idempotency
export { IdempotencyKey } from './idempotency/IdempotencyKey';
export type { IdempotencyStorePort } from './idempotency/IdempotencyStorePort';
export type { IdempotentCommand } from './idempotency/IdempotentCommand';
export { IdempotencyConflictError } from './idempotency/IdempotencyConflictError';
export { IdempotencyMetrics } from './idempotency/IdempotencyMetrics';
export { InMemoryIdempotencyStore } from './idempotency/InMemoryIdempotencyStore';
export { IdempotentUseCase } from './idempotency/IdempotentUseCase';
export type { WithIdempotencyKey } from './idempotency/IdempotentUseCase';

// Transactions
export type { UnitOfWork } from './transactions/UnitOfWork';
export { Transactional } from './transactions/Transactional';
