# @marcusprado02/saga

Saga pattern for distributed transactions. Supports both orchestration (central coordinator) and choreography (event-driven). Automatically runs compensation steps on failure.

## Installation

```bash
pnpm add @marcusprado02/saga
```

## Orchestration (Sequential)

```typescript
import { Saga, InMemorySagaStore } from '@marcusprado02/saga';

const store = new InMemorySagaStore();
const saga = new Saga('create-order', store);

saga
  .step('reserve-inventory', {
    execute: () => inventoryService.reserve(items),
    compensate: () => inventoryService.release(items),
  })
  .step('charge-payment', {
    execute: () => paymentService.charge(amount),
    compensate: () => paymentService.refund(amount),
  })
  .step('confirm-order', {
    execute: () => orderService.confirm(orderId),
    compensate: () => orderService.cancel(orderId),
  });

const result = await saga.run();
// On any step failure → compensations run in reverse order
```

## Transactions with Retry

```typescript
import { SagaTransaction } from '@marcusprado02/saga';

const tx = new SagaTransaction(saga, {
  retryAttempts: 3,
  retryDelayMs: 1000,
  timeoutMs: 30_000,
});
const result = await tx.execute();
```

## Choreography (Event-Driven)

```typescript
import { SagaChoreography } from '@marcusprado02/saga';

const choreography = new SagaChoreography(eventBus);
choreography.on('order.created', async (event) => {
  /* reserve inventory */
});
choreography.on('inventory.reserved', async (event) => {
  /* charge payment */
});
choreography.on('payment.failed', async (event) => {
  /* release inventory */
});
```

## See Also

- [`@marcusprado02/process-manager`](../process-manager) — state machine processes
- [`@marcusprado02/outbox`](../outbox) — transactional outbox for saga events
