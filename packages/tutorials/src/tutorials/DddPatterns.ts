import type { Tutorial, TutorialStep } from '../TutorialTypes';

const steps: readonly TutorialStep[] = [
  {
    id: 'ddd-1',
    title: 'Ubiquitous Language',
    description: 'Define the shared vocabulary between developers and domain experts.',
    codeExample: `// Good: use domain terms\nclass ShippingOrder {}\n// Bad: technical jargon\nclass ShipOrderDTO {}`,
    hints: ["Terms should match the domain expert's language."],
    validate: (input) =>
      input.length > 0
        ? { valid: true }
        : { valid: false, hint: 'Describe a domain term from your system.' },
  },
  {
    id: 'ddd-2',
    title: 'Bounded Context',
    description: 'Identify boundaries where a specific domain model applies.',
    codeExample: `// Billing context: Customer has a billing address\n// Shipping context: Customer has a delivery address`,
    hints: ['One word can have different meanings in different contexts.'],
    validate: (input) =>
      input.includes('context') || input.includes('Context')
        ? { valid: true }
        : { valid: false, hint: 'Mention a bounded context.' },
  },
  {
    id: 'ddd-3',
    title: 'Aggregate Root',
    description: 'Use an aggregate root to enforce invariants across a cluster of objects.',
    codeExample: `class Order extends AggregateRoot<string> {\n  addItem(item: OrderItem): Result<void> {}\n}`,
    hints: ['Only the root should allow external access.'],
    validate: (input) =>
      input.includes('AggregateRoot') || input.includes('aggregate')
        ? { valid: true }
        : { valid: false, hint: 'Reference an aggregate root.' },
  },
  {
    id: 'ddd-4',
    title: 'Domain Events',
    description: 'Raise domain events to communicate what happened inside the aggregate.',
    codeExample: `this.addDomainEvent(new OrderPlaced({ orderId: this.id }));`,
    hints: ['Domain events are named in the past tense.'],
    validate: (input) =>
      input.includes('Event') || input.includes('event')
        ? { valid: true }
        : { valid: false, hint: 'Reference a domain event.' },
  },
  {
    id: 'ddd-5',
    title: 'Repository Pattern',
    description: 'Abstract persistence behind a repository interface.',
    codeExample: `interface OrderRepository {\n  findById(id: string): Promise<Order | null>;\n  save(order: Order): Promise<void>;\n}`,
    hints: ['Repositories belong to the domain layer.'],
    validate: (input) =>
      input.includes('Repository') || input.includes('repository')
        ? { valid: true }
        : { valid: false, hint: 'Define a repository interface.' },
  },
];

export const DddPatternsTutorial: Tutorial = {
  id: 'ddd-patterns',
  title: 'DDD Patterns',
  description:
    'Explore core DDD building blocks: ubiquitous language, bounded contexts, aggregates, domain events and repositories.',
  difficulty: 'intermediate',
  category: 'ddd',
  tags: ['ddd', 'aggregate', 'domain-event', 'repository', 'bounded-context'],
  estimatedMinutes: 45,
  steps,
};
