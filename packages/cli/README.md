# @acme/cli

CLI tooling for scaffolding services, running code migrations, and managing project dependencies within the `@acme/*` ecosystem.

## Installation

```bash
pnpm add -D @acme/cli
# or globally
pnpm add -g @acme/cli
```

## Commands

### Scaffold a new service

```bash
acme scaffold service --name order-service --type microservice
acme scaffold package --name my-adapter --template adapter
```

### Migrate code

```bash
acme migrate --from v0 --to v1 --dry-run
acme migrate apply
```

### Check dependencies

```bash
acme deps check
acme deps upgrade --interactive
```

## Programmatic API

```typescript
import { ScaffoldCommand, ProjectInitializer, DependencyChecker } from '@acme/cli';

const scaffold = new ScaffoldCommand();
const result = await scaffold.run({ kind: 'service', name: 'order-service' });

const checker = new DependencyChecker();
const deps = await checker.check('./package.json');
```

## API

| Export               | Description                           |
| -------------------- | ------------------------------------- |
| `ScaffoldCommand`    | Generates service/package boilerplate |
| `MigrationCommand`   | Applies code migration scripts        |
| `ProjectInitializer` | Sets up a new project from scratch    |
| `DependencyChecker`  | Audits and reports dependency health  |
| `VersionManager`     | Tracks and bumps package versions     |

## See Also

- [`@acme/codegen`](../codegen) — code generator templates
- [`@acme/tutorials`](../tutorials) — interactive onboarding
