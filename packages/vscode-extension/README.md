# @acme/vscode-extension

VS Code extension utilities: code snippet library, DDD pattern detector, and architecture validator. Helps developers follow `@acme/*` patterns directly in the editor.

## Installation

This package is consumed by the VS Code extension. Install via the extension marketplace, or add as a dev dependency if building custom tooling:

```bash
pnpm add -D @acme/vscode-extension
```

## Code Snippets

```typescript
import { SnippetLibrary } from '@acme/vscode-extension';

const library = new SnippetLibrary();
const snippets = library.findByKind('entity');
// Returns ready-to-insert TypeScript snippet strings for @acme/kernel Entity classes
```

## DDD Pattern Detection

```typescript
import { PatternDetector } from '@acme/vscode-extension';

const detector = new PatternDetector();
const report = await detector.analyze('./src');
// report.patterns — list of detected DDD patterns (Entities, ValueObjects, etc.)
// report.violations — pattern usage issues
```

## Architecture Validation

```typescript
import { ArchitectureValidator } from '@acme/vscode-extension';

const validator = new ArchitectureValidator({ strictLayers: true });
const result = await validator.validate('./src');
// result.violations — layer boundary violations (domain importing infrastructure, etc.)
```

## See Also

- [`@acme/architecture-tests`](../architecture-tests) — CI-level architecture tests
- [`@acme/kernel`](../kernel) — domain primitives
