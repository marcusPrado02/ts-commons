// DDD Building Blocks
export { Entity } from './ddd/Entity';
export { AggregateRoot } from './ddd/AggregateRoot';
export { ValueObject } from './ddd/ValueObject';
export { DomainEvent } from './ddd/DomainEvent';
export type { DomainEventEnvelope } from './ddd/DomainEventEnvelope';
export type { DomainEventPublisher } from './ddd/DomainEventPublisher';
export { DomainEventRecorder } from './ddd/DomainEventRecorder';
export { Specification } from './ddd/Specification';
export { Factory } from './ddd/Factory';
export type { Repository } from './ddd/Repository';
export { AbstractRepository } from './ddd/Repository';
export type { DomainService } from './ddd/DomainService';
export { Policy } from './ddd/Policy';

// Identity Types
export { TenantId } from './identity/TenantId';
export { CorrelationId } from './identity/CorrelationId';
export { CausationId } from './identity/CausationId';
export { RequestId } from './identity/RequestId';
export { ULID } from './identity/ULID';
export { UUID } from './identity/UUID';

// Functional Primitives
export { Result } from './primitives/Result';
export { Option } from './primitives/Option';
export { Either } from './primitives/Either';

// Time Abstractions
export type { Clock } from './time/Clock';
export { SystemClock } from './time/SystemClock';
export { Instant } from './time/Instant';
export { Duration } from './time/Duration';

// Errors
export { DomainError } from './errors/DomainError';
export { InvariantViolationError } from './errors/InvariantViolationError';
export { NotFoundError } from './errors/NotFoundError';
export { ConflictError } from './errors/ConflictError';

// Ports (Interfaces)
export type { LoggerPort } from './ports/LoggerPort';
export type { TracerPort, SpanPort } from './ports/TracerPort';
export type { MetricsPort } from './ports/MetricsPort';
