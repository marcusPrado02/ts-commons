# @marcusprado02/web — Fastify and NestJS Adapters

HTTP transport layer adapters. Your application and domain code knows nothing about HTTP — these adapters translate between HTTP and `UseCase`/`Mediator`.

**Install:**

- `pnpm add @marcusprado02/web-fastify @marcusprado02/web` (Fastify)
- `pnpm add @marcusprado02/web-nestjs @marcusprado02/web` (NestJS)

---

## Fastify — `@marcusprado02/web-fastify`

### `FastifyControllerAdapter`

```typescript
import Fastify from 'fastify';
import {
  FastifyControllerAdapter,
  FastifyContextAdapter,
  CorrelationHook,
  LoggingHook,
  ErrorHandlerHook,
} from '@marcusprado02/web-fastify';

const app = Fastify({ logger: false });

// Global hooks
app.addHook('onRequest', CorrelationHook.create()); // inject/propagate correlationId
app.addHook('onRequest', LoggingHook.create(logger)); // log every request + duration
app.setErrorHandler(ErrorHandlerHook.create(errorMapper)); // map DomainError → HTTP status

// Controller
const orderController = new FastifyControllerAdapter(app, { prefix: '/orders' });

// POST /orders
orderController.post('/', async (request, reply) => {
  const ctx = FastifyContextAdapter.from(request);

  const result = await placeOrderUseCase.execute({
    ...ctx.body<PlaceOrderInput>(),
    correlationId: ctx.correlationId,
    tenantId: ctx.tenantId,
  });

  result.match({
    ok: (data) => reply.status(201).send(data),
    err: (err) => reply.status(422).send({ error: err.message }),
  });
});

// GET /orders/:id
orderController.get('/:id', async (request, reply) => {
  const { id } = request.params as { id: string };

  const result = await getOrderUseCase.execute({ orderId: id });

  result.match({
    ok: (order) => reply.send(order),
    err: (_err) => reply.status(404).send({ error: 'Order not found' }),
  });
});

await app.listen({ port: 3000, host: '0.0.0.0' });
```

### Hooks Reference

| Hook                             | Purpose                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `CorrelationHook.create()`       | Reads `X-Correlation-Id` header or generates one; stores in `CorrelationContext` |
| `LoggingHook.create(logger)`     | Logs request start/end with duration                                             |
| `ErrorHandlerHook.create()`      | Converts `DomainError` subtypes to appropriate HTTP status codes                 |
| `AuthHook.create(authenticator)` | Validates JWT and attaches principal to request                                  |
| `TenantHook.create()`            | Reads `X-Tenant-Id`; runs handler in `TenantContext`                             |

---

## NestJS — `@marcusprado02/web-nestjs`

### `CommonsCoreModule`

Registers `CommandBus`, `QueryBus`, and `Mediator` in the NestJS DI container.

```typescript
import { Module } from '@nestjs/common';
import {
  CommonsCoreModule,
  CommonsObservabilityModule,
  CommonsResilienceModule,
} from '@marcusprado02/web-nestjs';

@Module({
  imports: [
    CommonsCoreModule.forRoot({
      commandBus: true,
      queryBus: true,
      mediator: true,
    }),
    CommonsObservabilityModule.forRoot({
      serviceName: 'orders-service',
      otel: true,
    }),
    CommonsResilienceModule.forRoot({
      circuitBreaker: true,
      retry: true,
    }),
  ],
})
export class AppModule {}
```

### Controllers and Interceptors

```typescript
import { Controller, Post, Get, Param, Body, UseInterceptors, UseGuards } from '@nestjs/common';
import {
  LoggingInterceptor,
  CorrelationInterceptor,
  ErrorMappingInterceptor,
  IdempotencyGuard,
  RateLimitGuard,
} from '@marcusprado02/web-nestjs';
import { CommandBus, QueryBus } from '@marcusprado02/application';

@UseInterceptors(CorrelationInterceptor, LoggingInterceptor, ErrorMappingInterceptor)
@UseGuards(RateLimitGuard)
@Controller('orders')
export class OrderController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @UseGuards(IdempotencyGuard)
  async placeOrder(@Body() dto: PlaceOrderDto) {
    return this.commandBus.dispatch(new PlaceOrderCommand(dto.customerId, dto.items));
  }

  @Get(':id')
  async getOrder(@Param('id') id: string) {
    return this.queryBus.dispatch(new GetOrderQuery(id));
  }
}
```

### Guards Reference

| Guard              | Purpose                                                              |
| ------------------ | -------------------------------------------------------------------- |
| `JwtAuthGuard`     | Validates JWT bearer token                                           |
| `RolesGuard`       | Checks principal roles via `@Roles()` decorator                      |
| `RateLimitGuard`   | Applies rate limiting per IP / user                                  |
| `IdempotencyGuard` | Reads `Idempotency-Key` header; returns cached result for duplicates |

### Interceptors Reference

| Interceptor               | Purpose                                   |
| ------------------------- | ----------------------------------------- |
| `CorrelationInterceptor`  | Propagates `X-Correlation-Id`             |
| `LoggingInterceptor`      | Logs request + response                   |
| `ErrorMappingInterceptor` | Maps `DomainError` to HTTP responses      |
| `MetricsInterceptor`      | Records request count and latency metrics |

---

## Error Mapping

`@marcusprado02/errors` defines a hierarchy mapped to HTTP status codes:

| Error Class               | HTTP Status |
| ------------------------- | ----------- |
| `NotFoundError`           | 404         |
| `ConflictError`           | 409         |
| `UnauthorizedError`       | 401         |
| `ForbiddenError`          | 403         |
| `ValidationError`         | 422         |
| `InvariantViolationError` | 400         |
| `InternalError`           | 500         |

---

## Summary

| Export                       | Package       | Purpose                                 |
| ---------------------------- | ------------- | --------------------------------------- |
| `FastifyControllerAdapter`   | `web-fastify` | Route registration with prefix          |
| `FastifyContextAdapter`      | `web-fastify` | Type-safe request context               |
| `CorrelationHook`            | `web-fastify` | Inject correlationId                    |
| `LoggingHook`                | `web-fastify` | Request/response logging                |
| `ErrorHandlerHook`           | `web-fastify` | Map domain errors → HTTP                |
| `CommonsCoreModule`          | `web-nestjs`  | Register CommandBus, QueryBus, Mediator |
| `CommonsObservabilityModule` | `web-nestjs`  | Logger + tracer via DI                  |
| `LoggingInterceptor`         | `web-nestjs`  | NestJS logging interceptor              |
| `IdempotencyGuard`           | `web-nestjs`  | Header-based idempotency                |
| `JwtAuthGuard`               | `web-nestjs`  | JWT validation guard                    |
