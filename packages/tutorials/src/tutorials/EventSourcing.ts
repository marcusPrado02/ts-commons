import type { Tutorial, TutorialStep } from '../TutorialTypes';

const steps: readonly TutorialStep[] = [
  {
    id: 'es-1',
    title: 'Events as the Source of Truth',
    description:
      'Instead of storing current state, store every domain event that led to that state.',
    codeExample: `// Events stored\n[OrderPlaced, ItemAdded, PaymentReceived]\n// State rebuilt by replaying events`,
    hints: ['Events are immutable facts about what happened.'],
    validate: (input) =>
      input.includes('event') || input.includes('Event')
        ? { valid: true }
        : { valid: false, hint: 'Mention events as the source of truth.' },
  },
  {
    id: 'es-2',
    title: 'Event Store',
    description: 'Persist domain events in an append-only event store keyed by aggregate ID.',
    codeExample: `interface EventStore {\n  append(aggregateId: string, events: DomainEvent[]): Promise<void>;\n  load(aggregateId: string): Promise<DomainEvent[]>;\n}`,
    hints: ['Events are never updated or deleted.'],
    validate: (input) =>
      input.includes('EventStore') || input.includes('append')
        ? { valid: true }
        : { valid: false, hint: 'Define or reference an EventStore.' },
  },
  {
    id: 'es-3',
    title: 'Rebuilding State',
    description: 'Replay stored events through the aggregate to reconstruct current state.',
    codeExample: `const events = await eventStore.load(orderId);\nconst order = Order.rebuild(events);`,
    hints: ['Each event mutates aggregate state through an apply() method.'],
    validate: (input) =>
      input.includes('rebuild') || input.includes('apply') || input.includes('replay')
        ? { valid: true }
        : { valid: false, hint: 'Show how to rebuild state from events.' },
  },
  {
    id: 'es-4',
    title: 'Snapshots',
    description: 'Use snapshots to avoid replaying thousands of events for long-lived aggregates.',
    codeExample: `// Snapshot every 50 events\nif (version % 50 === 0) {\n  await snapshotStore.save(aggregate.snapshot());\n}`,
    hints: ['Load the latest snapshot + events after that snapshot.'],
    validate: (input) =>
      input.includes('snapshot') || input.includes('Snapshot')
        ? { valid: true }
        : { valid: false, hint: 'Mention snapshots to optimize replay.' },
  },
  {
    id: 'es-5',
    title: 'Projections',
    description: 'Build read models by projecting domain events into query-optimised views.',
    codeExample: `class OrderProjection {\n  on(event: OrderPlaced): void { /* upsert read model */ }\n}`,
    hints: ['Projections are eventually consistent with the event log.'],
    validate: (input) =>
      input.includes('Projection') || input.includes('projection')
        ? { valid: true }
        : { valid: false, hint: 'Define a projection for a read model.' },
  },
];

export const EventSourcingTutorial: Tutorial = {
  id: 'event-sourcing',
  title: 'Event Sourcing',
  description:
    'Master Event Sourcing: append-only event stores, state rebuilding, snapshots and projections.',
  difficulty: 'advanced',
  category: 'event-sourcing',
  tags: ['event-sourcing', 'event-store', 'projection', 'snapshot', 'aggregate'],
  estimatedMinutes: 60,
  steps,
};
