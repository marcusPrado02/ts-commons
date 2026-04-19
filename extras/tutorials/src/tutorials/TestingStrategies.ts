import type { Tutorial, TutorialStep } from '../TutorialTypes';

const steps: readonly TutorialStep[] = [
  {
    id: 'test-1',
    title: 'Unit Test Domain Logic',
    description:
      'Test pure domain functions without any infrastructure. No mocks for domain calls.',
    codeExample: `it('should place order', () => {\n  const order = Order.create('u1');\n  expect(order.isOk()).toBe(true);\n});`,
    hints: ['Domain logic should be testable without a database.'],
    validate: (input) =>
      input.includes('expect') || input.includes('assert')
        ? { valid: true }
        : { valid: false, hint: 'Write an assertion for domain logic.' },
  },
  {
    id: 'test-2',
    title: 'In-Memory Repository',
    description:
      'Use an in-memory repository to test application services without real persistence.',
    codeExample: `class InMemoryOrderRepo implements OrderRepository {\n  private store = new Map<string, Order>();\n}`,
    hints: ['In-memory repos are fast and deterministic.'],
    validate: (input) =>
      input.includes('InMemory') || input.includes('in-memory') || input.includes('Map()')
        ? { valid: true }
        : { valid: false, hint: 'Create an in-memory repository.' },
  },
  {
    id: 'test-3',
    title: 'Test Domain Events',
    description: 'Assert that the correct domain events were raised after a command.',
    codeExample: `const events = order.pullDomainEvents();\nexpect(events[0]).toBeInstanceOf(OrderPlaced);`,
    hints: ['pullDomainEvents() drains and returns the pending events.'],
    validate: (input) =>
      input.includes('DomainEvent') || input.includes('pullDomainEvents') || input.includes('event')
        ? { valid: true }
        : { valid: false, hint: 'Assert a domain event was raised.' },
  },
  {
    id: 'test-4',
    title: 'Integration Test with Vitest',
    description: 'Write integration tests that wire together multiple real components.',
    codeExample: `describe('PlaceOrderHandler', () => {\n  it('saves order and raises event', async () => {});\n});`,
    hints: ['Integration tests may use a real DB via test containers.'],
    validate: (input) =>
      input.includes('describe') || input.includes('it(') || input.includes('test(')
        ? { valid: true }
        : { valid: false, hint: 'Wrap tests in a describe block.' },
  },
  {
    id: 'test-5',
    title: 'Test Result<T> Errors',
    description: 'Verify that failure paths return the expected error messages.',
    codeExample: `const result = Order.create('');\nexpect(result.isFailure()).toBe(true);\nexpect(result.error).toBe('ID is required');`,
    hints: ['Always test both happy and unhappy paths.'],
    validate: (input) =>
      input.includes('isFailure') || input.includes('error') || input.includes('Result')
        ? { valid: true }
        : { valid: false, hint: 'Test the failure path of a Result.' },
  },
];

export const TestingStrategiesTutorial: Tutorial = {
  id: 'testing-strategies',
  title: 'Testing Strategies',
  description:
    'Learn effective DDD testing: unit tests for domain logic, in-memory repos, event assertions and Result error testing.',
  difficulty: 'intermediate',
  category: 'testing',
  tags: ['testing', 'unit-test', 'in-memory', 'vitest', 'domain-events', 'result'],
  estimatedMinutes: 40,
  steps,
};
