import type { Tutorial, TutorialStep } from '../TutorialTypes';

const steps: readonly TutorialStep[] = [
  {
    id: 'mig-1',
    title: 'Identify the Core Domain',
    description:
      'Audit the monolith to find the core subdomain that provides the most business value.',
    codeExample: `// Map capabilities:\n// - Orders (core)\n// - Billing (supporting)\n// - Notifications (generic)`,
    hints: ['Start with the most valuable, most complex subdomain.'],
    validate: (input) =>
      input.includes('domain') || input.includes('subdomain') || input.includes('context')
        ? { valid: true }
        : { valid: false, hint: 'Identify a core or supporting subdomain.' },
  },
  {
    id: 'mig-2',
    title: 'Define Bounded Contexts',
    description: 'Draw context maps to show how subdomains interact and where boundaries lie.',
    codeExample: `// Context Map\n// Orders ─── ACL ───> Notifications\n// Orders ─── Partnership ─── Billing`,
    hints: ['Use Anti-Corruption Layers to protect domain models.'],
    validate: (input) =>
      input.includes('Context') || input.includes('ACL') || input.includes('map')
        ? { valid: true }
        : { valid: false, hint: 'Describe a context map or ACL.' },
  },
  {
    id: 'mig-3',
    title: 'Strangler Fig Pattern',
    description:
      'Gradually replace monolith features by routing traffic to the new service, then retire old code.',
    codeExample: `// 1. New service handles /orders/v2/*\n// 2. Reverse proxy routes matching traffic\n// 3. Remove old monolith route`,
    hints: ['Never big-bang rewrite; strangle incrementally.'],
    validate: (input) =>
      input.includes('strangler') || input.includes('route') || input.includes('proxy')
        ? { valid: true }
        : { valid: false, hint: 'Describe the strangler fig approach.' },
  },
  {
    id: 'mig-4',
    title: 'Extract Domain Logic First',
    description:
      'Move pure domain classes (Entity, ValueObject) with zero infrastructure before touching HTTP or DB.',
    codeExample: `// Move to @acme/kernel\nclass Order extends Entity<string> {}\nclass Money extends ValueObject<{ amount: number; currency: string }> {}`,
    hints: ['Domain code has no imports from Express, Prisma, etc.'],
    validate: (input) =>
      input.includes('Entity') || input.includes('ValueObject') || input.includes('domain')
        ? { valid: true }
        : { valid: false, hint: 'Extract an Entity or ValueObject.' },
  },
  {
    id: 'mig-5',
    title: 'Anti-Corruption Layer',
    description:
      'Translate the legacy model to your domain model using an ACL adapter on the boundary.',
    codeExample: `class LegacyOrderAdapter {\n  toDomain(raw: LegacyOrder): Order {\n    return Order.create(raw.id, Money.create(raw.total));\n  }\n}`,
    hints: ['The ACL prevents legacy concepts from leaking into your domain.'],
    validate: (input) =>
      input.includes('Adapter') || input.includes('ACL') || input.includes('translate')
        ? { valid: true }
        : { valid: false, hint: 'Implement an adapter or ACL.' },
  },
  {
    id: 'mig-6',
    title: 'Event-Driven Decoupling',
    description:
      'Decouple contexts by publishing domain events instead of calling other services directly.',
    codeExample: `// After migrating Orders:\nawait eventBus.publish(new OrderPlaced({ orderId, userId }));\n// Billing subscribes to OrderPlaced`,
    hints: ['Events allow contexts to evolve independently.'],
    validate: (input) =>
      input.includes('event') || input.includes('publish') || input.includes('subscribe')
        ? { valid: true }
        : { valid: false, hint: 'Use events to decouple contexts.' },
  },
];

export const MigrationFromMonolithTutorial: Tutorial = {
  id: 'migration-from-monolith',
  title: 'Migration from Monolith',
  description:
    'Step-by-step guide to migrate a monolithic application to a DDD-based modular architecture.',
  difficulty: 'advanced',
  category: 'migration',
  tags: ['migration', 'monolith', 'strangler-fig', 'bounded-context', 'acl', 'event-driven'],
  estimatedMinutes: 90,
  steps,
};
