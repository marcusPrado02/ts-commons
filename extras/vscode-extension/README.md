# @marcusprado02/vscode-extension

VS Code extension utilities: code snippet library, DDD pattern detector, and architecture validator. Helps developers follow `@marcusprado02/*` patterns directly in the editor.

## Installation

This package is consumed by the VS Code extension. Install via the extension marketplace, or add as a dev dependency if building custom tooling:

```bash
pnpm add -D @marcusprado02/vscode-extension
```

## Code Snippets

```typescript
import { SnippetLibrary } from '@marcusprado02/vscode-extension';

const library = new SnippetLibrary();
const snippets = library.findByKind('entity');
// Returns ready-to-insert TypeScript snippet strings for @marcusprado02/kernel Entity classes
```

## DDD Pattern Detection

```typescript
import { PatternDetector } from '@marcusprado02/vscode-extension';

const detector = new PatternDetector();
const report = await detector.analyze('./src');
// report.patterns — list of detected DDD patterns (Entities, ValueObjects, etc.)
// report.violations — pattern usage issues
```

## Architecture Validation

```typescript
import { ArchitectureValidator } from '@marcusprado02/vscode-extension';

const validator = new ArchitectureValidator({ strictLayers: true });
const result = await validator.validate('./src');
// result.violations — layer boundary violations (domain importing infrastructure, etc.)
```

## See Also

- [`@marcusprado02/architecture-tests`](../architecture-tests) — CI-level architecture tests
- [`@marcusprado02/kernel`](../kernel) — domain primitives
