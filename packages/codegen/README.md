# @marcusprado02/codegen

Code generators for common patterns — CRUD repositories, REST API endpoints, test suites, and database migrations. Produces clean, typed TypeScript scaffolding.

## Installation

```bash
pnpm add -D @marcusprado02/codegen
```

## Quick Start

```typescript
import { CrudGenerator, GeneratorRegistry } from '@marcusprado02/codegen';

const registry = new GeneratorRegistry();
registry.register(new CrudGenerator());

const result = await registry.run('crud', {
  entity: 'Order',
  fields: [
    { name: 'id', type: 'string', required: true },
    { name: 'total', type: 'number', required: true },
    { name: 'status', type: 'string', required: false },
  ],
  outputDir: './src/orders',
});

// result.files — list of generated TypeScript files
```

## Generators

| Generator              | What it produces                            |
| ---------------------- | ------------------------------------------- |
| `CrudGenerator`        | Repository + service + DTOs for an entity   |
| `ApiEndpointGenerator` | Express/Fastify route handlers + validation |
| `TestSuiteGenerator`   | Vitest test files with fixtures and mocks   |
| `MigrationGenerator`   | SQL or Prisma migration files               |

## Template Engine

```typescript
import { render, capitalize, toKebab } from '@marcusprado02/codegen';

const code = render('class {{Name}}Repository { }', { Name: capitalize('order') });
// 'class OrderRepository { }'
```

## See Also

- [`@marcusprado02/cli`](../cli) — CLI wrapper for these generators
- [`@marcusprado02/testing`](../testing) — test builders and fakes
