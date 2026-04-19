# @marcusprado02/tutorials

Interactive, step-by-step tutorials for the `@marcusprado02/*` ecosystem. Covers DDD patterns, CQRS, event sourcing, testing strategies, and monolith migration — with validated exercises.

## Installation

```bash
pnpm add @marcusprado02/tutorials
```

## Quick Start

```typescript
import { TutorialEngine, TutorialRegistry, GettingStartedTutorial } from '@marcusprado02/tutorials';

const registry = new TutorialRegistry();
registry.add(new GettingStartedTutorial());

const engine = new TutorialEngine(registry);
const session = engine.start('getting-started', { userId: 'dev-1' });

// Step through the tutorial
const step = session.currentStep();
console.log(step.title, step.instructions);

// Validate exercise completion
const result = await session.validate({ code: userCode });
if (result.passed) await session.advance();
```

## Available Tutorials

| Tutorial                | Class                           |
| ----------------------- | ------------------------------- |
| Getting Started         | `GettingStartedTutorial`        |
| DDD Patterns            | `DddPatternsTutorial`           |
| CQRS                    | `CqrsTutorial`                  |
| Event Sourcing          | `EventSourcingTutorial`         |
| Testing Strategies      | `TestingStrategiesTutorial`     |
| Migration from Monolith | `MigrationFromMonolithTutorial` |

## See Also

- [`@marcusprado02/cli`](../cli) — CLI scaffolding
- [`@marcusprado02/codegen`](../codegen) — code generation
