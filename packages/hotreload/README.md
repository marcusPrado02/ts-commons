# @marcusprado02/hotreload

Hot-reload orchestration for development: watches source files, triggers incremental TypeScript compilation, and refreshes tests automatically on change.

## Installation

```bash
pnpm add -D @marcusprado02/hotreload
```

## Quick Start

```typescript
import { HotReloadOrchestrator } from '@marcusprado02/hotreload';

const orchestrator = new HotReloadOrchestrator({
  watchPaths: ['./src'],
  testPattern: '**/*.test.ts',
  debounceMs: 200,
});

orchestrator.start();
// Watches src/, compiles incrementally, re-runs affected tests on change
```

## Components

| Export                  | Description                                             |
| ----------------------- | ------------------------------------------------------- |
| `HotReloadOrchestrator` | Coordinates watcher → compiler → test refresher         |
| `WatchManager`          | File system watcher with debounce and pattern filtering |
| `IncrementalCompiler`   | Runs `tsc --incremental` on changed files               |
| `TestRefresher`         | Triggers Vitest/Jest re-run for affected test files     |

## Events

```typescript
orchestrator.on('compiled', (result) => {
  console.log(`Compiled in ${result.durationMs}ms`);
});

orchestrator.on('tests:refreshed', (result) => {
  console.log(`${result.passedCount} passed, ${result.failedCount} failed`);
});
```

## See Also

- [`@marcusprado02/features`](../features) — feature flags with hot-reload support
- [`@marcusprado02/config`](../config) — configuration hot-reload
