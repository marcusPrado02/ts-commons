import type { Tutorial, TutorialStep } from '../TutorialTypes';

const steps: readonly TutorialStep[] = [
  {
    id: 'gs-1',
    title: 'Install @acme/kernel',
    description: 'Add the core kernel package to your project.',
    codeExample: 'pnpm add @acme/kernel',
    expectedOutput: 'node_modules/@acme/kernel',
    hints: ['Run the command in your project root.'],
    validate: (input) =>
      input.includes('@acme/kernel')
        ? { valid: true }
        : { valid: false, hint: 'Make sure you reference @acme/kernel.' },
  },
  {
    id: 'gs-2',
    title: 'Create your first Entity',
    description: 'Extend Entity<T> with a typed ID.',
    codeExample: `import { Entity } from '@acme/kernel';\nclass User extends Entity<string> {}`,
    hints: ['Entity takes a generic type for its ID.'],
    validate: (input) =>
      input.includes('Entity')
        ? { valid: true }
        : { valid: false, hint: 'Your class must extend Entity.' },
  },
  {
    id: 'gs-3',
    title: 'Create a ValueObject',
    description: 'Extend ValueObject<T> for immutable domain concepts.',
    codeExample: `import { ValueObject } from '@acme/kernel';\nclass Email extends ValueObject<{ value: string }> {}`,
    hints: ['ValueObject requires a plain props type.'],
    validate: (input) =>
      input.includes('ValueObject')
        ? { valid: true }
        : { valid: false, hint: 'Your class must extend ValueObject.' },
  },
  {
    id: 'gs-4',
    title: 'Use Result<T>',
    description: 'Return Result.ok or Result.fail from domain methods.',
    codeExample: `return Result.ok(user);\nreturn Result.fail('Not found');`,
    hints: ['Avoid throwing exceptions in domain logic.'],
    validate: (input) =>
      input.includes('Result')
        ? { valid: true }
        : { valid: false, hint: 'Use Result.ok or Result.fail.' },
  },
];

export const GettingStartedTutorial: Tutorial = {
  id: 'getting-started',
  title: 'Getting Started with @acme/ts-commons',
  description: 'Learn to install and use the core building blocks: Entity, ValueObject and Result.',
  difficulty: 'beginner',
  category: 'getting-started',
  tags: ['intro', 'entity', 'value-object', 'result'],
  estimatedMinutes: 20,
  steps,
};
