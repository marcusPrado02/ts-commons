# @acme/docs

Story-driven interactive documentation for `@acme` TypeScript components. Provides a lightweight story registry and runner — similar in spirit to Storybook but framework-free — along with a component catalog and pre-built story modules for core `@acme` types.

## Installation

```bash
npm install @acme/docs
```

## Key Exports

### Story Infrastructure

- `StoryDef`, `StoryMeta`, `StoryModule`, `StoryArgs`, `StoryResult`, `StoryStatus` — types that describe a story and its outcome
- `CatalogEntry`, `DocsSummary`, `ModuleResult` — catalog and summary types
- `StoryRegistry` — register story modules by name; used as the central catalog
- `StoryRunner` — execute registered stories and collect results

### Interactive Catalog

- `ComponentCatalog` — aggregates all registered modules; provides a high-level summary and entry-point for doc generation or interactive display

### Built-in Story Modules

Pre-built story sets that document and exercise core `@acme` primitives:

| Export                                                              | Covers                                   |
| ------------------------------------------------------------------- | ---------------------------------------- |
| `EmailModule`, `MoneyModule`                                        | Value object construction and validation |
| `ResultModule`, `OptionModule`, `EitherModule`                      | Functional result/option/either patterns |
| `DomainErrorModule`, `NotFoundErrorModule`, `ValidationErrorModule` | Typed domain error hierarchies           |

## Usage

```typescript
import { StoryRegistry, StoryRunner, EmailModule, ResultModule } from '@acme/docs';

// Register built-in modules
StoryRegistry.register('email', EmailModule);
StoryRegistry.register('result', ResultModule);

// Run all stories and inspect results
const runner = new StoryRunner(StoryRegistry);
const summary = await runner.runAll();

console.log(`${summary.passed} passed, ${summary.failed} failed`);
```

Extend with your own stories:

```typescript
import { StoryDef, StoryModule } from '@acme/docs';

const myModule: StoryModule = {
  name: 'OrderAggregate',
  stories: [
    {
      name: 'creates an order',
      run: async () => {
        const order = Order.create({ items: [] });
        return order.isOk() ? { status: 'pass' } : { status: 'fail', error: order.error };
      },
    } satisfies StoryDef,
  ],
};

StoryRegistry.register('order', myModule);
```

## Dependencies

No runtime dependencies.
