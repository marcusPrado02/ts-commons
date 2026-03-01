# @acme/saga

Orchestration-based Saga with automatic compensation. Use when a business operation spans multiple services and requires rollback if any step fails.

**Install:** `pnpm add @acme/saga @acme/kernel @acme/application`

---

## When to Use Sagas

Use a saga when you need to coordinate multiple service calls atomically — and you need compensation (rollback) if any step fails:

- Checkout: reserve stock → charge payment → confirm order
- Account creation: create profile → send welcome email → setup billing

If any step fails, all previously completed steps are compensated in reverse order.

---

## `SagaTransaction` — Orchestration

```typescript
import { SagaTransaction } from '@acme/saga';

const checkoutSaga = new SagaTransaction('checkout')
  .addStep({
    name: 'reserve-stock',
    execute: (ctx) => stockService.reserve(ctx.items),
    compensate: (ctx) => stockService.release(ctx.items),
  })
  .addStep({
    name: 'charge-payment',
    execute: (ctx) => paymentService.charge(ctx.total, ctx.customerId),
    compensate: (ctx) => paymentService.refund(ctx.chargeId),
  })
  .addStep({
    name: 'confirm-order',
    execute: (ctx) => orderService.confirm(ctx.orderId),
    compensate: (ctx) => orderService.cancel(ctx.orderId),
  });

const result = await checkoutSaga.run({
  orderId: 'order-123',
  customerId: 'customer-abc',
  items: orderItems,
  total: totalAmount,
});

result.match({
  ok: () => log.info('Checkout complete'),
  err: (err) =>
    log.error('Saga compensated', {
      failedStep: err.failedStep,
      compensatedSteps: err.compensatedSteps,
      originalError: err.cause,
    }),
});
```

---

## Passing Data Between Steps

Each step receives the shared `context` object. You can mutate it to pass data to later steps:

```typescript
const checkoutSaga = new SagaTransaction<CheckoutContext>('checkout').addStep({
  name: 'charge-payment',
  execute: async (ctx) => {
    const charge = await paymentService.charge(ctx.total, ctx.customerId);
    ctx.chargeId = charge.id; // write to context for compensation step
  },
  compensate: (ctx) => paymentService.refund(ctx.chargeId!),
});
```

---

## `SagaChoreography` — Event-Driven Coordination

For loosely coupled sagas where each service reacts to events independently:

```typescript
import { SagaChoreography } from '@acme/saga';

const saga = new SagaChoreography('order-fulfilment');

saga.on('OrderPlacedEvent', async (event) => {
  await inventoryService.reserve(event.items);
  await publisher.publish(new StockReservedEvent(event.orderId));
});

saga.on('StockReservedEvent', async (event) => {
  await paymentService.charge(event.orderId);
});

saga.on('PaymentFailedEvent', async (event) => {
  await inventoryService.release(event.orderId); // compensate
  await orderService.cancel(event.orderId);
});
```

---

## `SagaMonitor` — Observability

```typescript
import { SagaMonitor } from '@acme/saga';

const monitor = new SagaMonitor(metrics, logger);

// Attach to a saga — records step durations, failures, compensations
checkoutSaga.use(monitor);
```

---

## Error Handling

When a saga fails:

```typescript
result.match({
  err: (err) => {
    // err.failedStep       → name of the step that threw
    // err.cause            → original error
    // err.compensatedSteps → steps that were compensated (rolled back)
    // err.context          → full context at time of failure
  },
});
```

---

## Summary

| Export               | Purpose                                              |
| -------------------- | ---------------------------------------------------- |
| `SagaTransaction<C>` | Orchestration saga with step list and compensation   |
| `SagaChoreography`   | Event-driven saga coordination                       |
| `SagaMonitor`        | Metrics and logging for saga execution               |
| `SagaStep<C>`        | Step definition type (execute + compensate)          |
| `SagaError`          | Error type with failed step and compensation details |
