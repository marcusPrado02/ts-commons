# @acme/web-nestjs

NestJS integration package providing Clean Architecture-compliant modules, decorators, interceptors, guards, and pipes for building production-ready web applications.

## Features

- **Core Module**: Clock injection for time operations
- **Observability Module**: Structured logging with correlation IDs
- **Resilience Module**: Circuit breaker integration
- **Outbox Module**: Transactional outbox pattern
- **CQRS Decorators**: `@UseCase`, `@CommandHandler`, `@QueryHandler`
- **Interceptors**: Correlation tracking, request/response logging, error mapping to Problem Details RFC 7807
- **Guards**: Idempotency protection, rate limiting
- **Validation Pipe**: Type-safe validation with Result types

## Installation

```bash
pnpm add @acme/web-nestjs
```

## Quick Start

### 1. Import Modules

```typescript
import { Module } from '@nestjs/common';
import {
  CommonsCoreModule,
  CommonsObservabilityModule,
  CommonsResilienceModule,
  CommonsOutboxModule,
} from '@acme/web-nestjs';

@Module({
  imports: [
    CommonsCoreModule.forRoot(),
    CommonsObservabilityModule.forRoot({
      serviceName: 'my-service',
    }),
    CommonsResilienceModule.forRoot(),
    CommonsOutboxModule.forRoot({
      processingIntervalMs: 5000,
    }),
  ],
})
export class AppModule {}
```

### 2. Use Decorators

```typescript
import { Controller, Get, Post, Body } from '@nestjs/common';
import { UseCase, QueryHandler, CommandHandler } from '@acme/web-nestjs';

@Controller('users')
@UseCase('UserManagement')
export class UsersController {
  @Get()
  @QueryHandler('GetAllUsers')
  async getAll() {
    return [];
  }

  @Post()
  @CommandHandler('CreateUser')
  async create(@Body() dto: CreateUserDto) {
    return { id: '1', ...dto };
  }
}
```

### 3. Apply Interceptors and Guards

```typescript
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import {
  CorrelationInterceptor,
  LoggingInterceptor,
  ErrorMappingInterceptor,
  IdempotencyGuard,
  RateLimitGuard,
} from '@acme/web-nestjs';

@Module({
  providers: [
    { provide: APP_INTERCEPTOR, useClass: CorrelationInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ErrorMappingInterceptor },
    { provide: APP_GUARD, useClass: IdempotencyGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
})
export class AppModule {}
```

### 4. Use Validation Pipe

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { ValidationPipe, ValidatorFn } from '@acme/web-nestjs';
import { Result } from '@acme/kernel';

interface CreateUserDto {
  name: string;
  email: string;
}

const createUserValidator: ValidatorFn<CreateUserDto> = (data) => {
  const dto = data as CreateUserDto;
  if (!dto.email.includes('@')) {
    return Result.err(new Error('Invalid email'));
  }
  return Result.ok(dto);
};

@Controller('users')
export class UsersController {
  @Post()
  async create(
    @Body(new ValidationPipe(createUserValidator)) dto: CreateUserDto
  ) {
    return { id: '1', ...dto };
  }
}
```

## API Reference

### Modules

#### CommonsCoreModule

Provides Clock injection for time operations.

```typescript
CommonsCoreModule.forRoot(options?: CommonsOptions)

interface CommonsOptions {
  clock?: Clock;
}
```

#### CommonsObservabilityModule

Provides Logger injection for structured logging.

```typescript
CommonsObservabilityModule.forRoot(options?: ObservabilityOptions)

interface ObservabilityOptions {
  serviceName: string;
  logger?: Logger;
}
```

#### CommonsResilienceModule

Provides CircuitBreaker integration.

```typescript
CommonsResilienceModule.forRoot(options?: ResilienceOptions)

interface ResilienceOptions {
  circuitBreaker?: CircuitBreaker;
}
```

#### CommonsOutboxModule

Provides OutboxStore injection for transactional outbox pattern.

```typescript
CommonsOutboxModule.forRoot(options?: OutboxOptions)

interface OutboxOptions {
  store?: OutboxStorePort;
  processingIntervalMs?: number;
}
```

### Decorators

- `@UseCase(name: string)`: Mark controllers/handlers as use cases
- `@CommandHandler(commandName: string)`: Mark handlers for commands
- `@QueryHandler(queryName: string)`: Mark handlers for queries

### Interceptors

- **CorrelationInterceptor**: Generates or extracts correlation IDs from `X-Correlation-ID` header
- **LoggingInterceptor**: Logs structured request/response with duration tracking
- **ErrorMappingInterceptor**: Converts errors to Problem Details RFC 7807

### Guards

- **IdempotencyGuard**: Prevents duplicate request processing using `Idempotency-Key` header
- **RateLimitGuard**: Per-IP/user rate limiting with configurable window

### Pipes

- **ValidationPipe**: Type-safe validation using `ValidatorFn<T>` and Result types

## Architecture

This package follows Clean Architecture principles:

- **Framework Boundary**: Isolates NestJS-specific code from domain logic
- **Dependency Injection**: Leverages NestJS DI for all components
- **Type Safety**: Uses TypeScript strict mode and Result types
- **Error Handling**: Standardized Problem Details RFC 7807
- **Observability**: Built-in correlation tracking and structured logging

## Comparison with Other Adapters

| Feature | Express | Fastify | NestJS |
|---------|---------|---------|--------|
| Dependency Injection | Manual | Manual | Built-in |
| Decorators | Custom | Custom | Native |
| Interceptors | Middleware | Hooks | Interceptors |
| Guards | Middleware | Hooks | Guards |
| Validation | Middleware | Hooks | Pipes |
| Module System | None | Plugins | Modules |

## Testing

```bash
pnpm test
```

## License

MIT
