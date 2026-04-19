import type { Tutorial, TutorialStep } from '../TutorialTypes';

const steps: readonly TutorialStep[] = [
  {
    id: 'cqrs-1',
    title: 'Separate Commands from Queries',
    description:
      'Commands mutate state and return void or Result. Queries return data without side effects.',
    codeExample: `// Command\nclass PlaceOrderCommand { constructor(readonly userId: string) {} }\n// Query\nclass GetOrderQuery { constructor(readonly orderId: string) {} }`,
    hints: ['Commands end in an imperative verb, queries start with Get/Find/List.'],
    validate: (input) =>
      input.includes('Command') || input.includes('Query')
        ? { valid: true }
        : { valid: false, hint: 'Define a Command or Query class.' },
  },
  {
    id: 'cqrs-2',
    title: 'Command Handler',
    description: 'Implement a handler that processes a single command.',
    codeExample: `class PlaceOrderHandler {\n  async execute(cmd: PlaceOrderCommand): Promise<Result<void>> {}\n}`,
    hints: ['Each handler handles exactly one command.'],
    validate: (input) =>
      input.includes('Handler') || input.includes('handler')
        ? { valid: true }
        : { valid: false, hint: 'Implement a command handler.' },
  },
  {
    id: 'cqrs-3',
    title: 'Query Handler',
    description: 'Implement a handler that reads and returns data.',
    codeExample: `class GetOrderHandler {\n  async execute(query: GetOrderQuery): Promise<OrderDto | null> {}\n}`,
    hints: ['Query handlers may use a separate read model or projection.'],
    validate: (input) =>
      input.includes('Handler') || input.includes('handler')
        ? { valid: true }
        : { valid: false, hint: 'Implement a query handler.' },
  },
  {
    id: 'cqrs-4',
    title: 'Command Bus',
    description: 'Use a command bus to dispatch commands to their handlers.',
    codeExample: `await commandBus.dispatch(new PlaceOrderCommand(userId));`,
    hints: ['A command bus decouples the caller from the handler.'],
    validate: (input) =>
      input.includes('dispatch') || input.includes('bus')
        ? { valid: true }
        : { valid: false, hint: 'Use dispatch or mention a command bus.' },
  },
];

export const CqrsTutorial: Tutorial = {
  id: 'cqrs',
  title: 'CQRS',
  description:
    'Learn Command Query Responsibility Segregation: separate write and read models for cleaner architecture.',
  difficulty: 'intermediate',
  category: 'cqrs',
  tags: ['cqrs', 'command', 'query', 'handler', 'bus'],
  estimatedMinutes: 35,
  steps,
};
