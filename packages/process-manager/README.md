# @acme/process-manager

Long-running process coordination using state machines. Models multi-step workflows (orders, onboarding, approvals) as processes with typed state transitions, timeouts, and correlation.

## Installation

```bash
pnpm add @acme/process-manager
```

## Quick Start

```typescript
import { ProcessManager, StateMachine, InMemoryProcessStore } from '@acme/process-manager';

// Define state machine transitions
const machine = new StateMachine<'pending' | 'processing' | 'shipped' | 'cancelled'>({
  initial: 'pending',
  transitions: [
    { from: 'pending', to: 'processing', on: 'START' },
    { from: 'processing', to: 'shipped', on: 'SHIP' },
    { from: 'processing', to: 'cancelled', on: 'CANCEL' },
    { from: 'pending', to: 'cancelled', on: 'CANCEL' },
  ],
});

const store = new InMemoryProcessStore();
const manager = new ProcessManager(machine, store);

// Start a process
const process = await manager.start('order-process', { orderId: 'ord-123' });

// Transition
await manager.transition(process.id, 'START');
await manager.transition(process.id, 'SHIP');
```

## Timeouts

```typescript
import { ProcessTimeoutScheduler } from '@acme/process-manager';

const scheduler = new ProcessTimeoutScheduler(manager, {
  onTimeout: async (process) => manager.transition(process.id, 'CANCEL'),
  defaultTimeoutMs: 30 * 60_000, // 30 minutes
});
scheduler.start();
```

## Correlation

```typescript
import { ProcessCorrelator } from '@acme/process-manager';

const correlator = new ProcessCorrelator(store);
const processes = await correlator.findByCorrelationId('order-123');
```

## See Also

- [`@acme/saga`](../saga) — distributed saga orchestration
- [`@acme/application`](../application) — use-case and command bus
