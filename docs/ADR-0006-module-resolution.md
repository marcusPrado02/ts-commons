# ADR-0006: Module Resolution Strategy

## Status
**Accepted** - 18/02/2026

## Context
TypeScript and Node.js offer different module resolution strategies that affect how imports are resolved and bundled. We need to choose the most appropriate strategy for our monorepo.

## Decision
We will use **bundler** module resolution with ESM-first approach:

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true
  }
}
```

## Rationale

### Bundler Resolution Benefits:
- **Tree-shaking**: Better support for unused code elimination
- **Modern tooling**: Optimized for Vite, Rollup, esbuild
- **Import flexibility**: Supports both ESM and CJS patterns
- **Future-proof**: Aligns with modern JavaScript ecosystem

### ESM-First Strategy:
- **Performance**: Native ES modules are faster
- **Standards compliance**: Following web standards
- **Tooling ecosystem**: Better support in modern tools
- **Bundle size**: Smaller bundles through tree-shaking

## Implementation

### Package.json Configuration:
```json
{
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  }
}
```

### Import Patterns:
```typescript
// Preferred: ESM imports
import { Entity } from '@acme/kernel';
import type { Command } from '@acme/application';

// Avoid: CommonJS patterns
const { Entity } = require('@acme/kernel');
```

## Consequences

### Positive:
- ✅ Better tree-shaking and bundle optimization
- ✅ Future-proof module system
- ✅ Improved development experience with modern tooling
- ✅ Smaller bundle sizes for consumers

### Negative:
- ❌ Learning curve for developers familiar with CommonJS
- ❌ Some legacy tooling may require configuration
- ❌ Import order matters more in ESM

### Mitigation:
- Comprehensive documentation and examples
- ESLint rules to enforce consistent import patterns
- TypeScript strict mode to catch import issues early

## References
- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)
- [Node.js ES Modules](https://nodejs.org/api/esm.html)
- [Bundler Module Resolution](https://www.typescriptlang.org/tsconfig#moduleResolution)
