# ADR-0007: ESM vs CommonJS Decision

## Status
**Accepted** - 18/02/2026

## Context
Node.js supports both CommonJS (CJS) and ES Modules (ESM). Our monorepo needs to choose a consistent module format that works well for both internal development and external consumption.

## Decision
We will use **ES Modules (ESM) as the primary module format** with dual package publishing for backwards compatibility.

## Rationale

### ESM Advantages:
- **Static analysis**: Better tree-shaking and dead code elimination
- **Standards-based**: Web standards compliant
- **Performance**: Faster loading and parsing
- **Top-level await**: Support for async initialization
- **Import maps**: Future browser support
- **Interoperability**: Better integration with modern tooling

### Implementation Strategy:
```json
// package.json
{
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  }
}
```

## Implementation Details

### Source Code Format:
- All source files use ESM syntax (`.ts` files)
- Import/export statements instead of require/module.exports
- Top-level await where appropriate
- File extensions explicit in relative imports

### Build Output:
- **ESM build**: Direct TypeScript compilation to ESM
- **CJS build**: Bundled CommonJS for backwards compatibility
- **Type definitions**: Shared `.d.ts` files for both formats

### Example Code Patterns:

#### Exports (ESM):
```typescript
// src/index.ts
export { Entity } from './Entity.js';
export { ValueObject } from './ValueObject.js';
export type { DomainEvent } from './DomainEvent.js';

// Default export
export default class Application {
  // implementation
}
```

#### Imports (ESM):
```typescript
// Relative imports with extensions
import { Entity } from './Entity.js';
import type { IDomainEvent } from './types.js';

// Package imports
import { Result } from '@acme/kernel';
import type { Command } from '@acme/application';

// Dynamic imports
const { Logger } = await import('@acme/observability');
```

#### Top-level Await:
```typescript
// Configuration loading
const config = await loadConfiguration();

// Dynamic feature loading
const features = await Promise.all([
  import('./features/authentication.js'),
  import('./features/authorization.js')
]);
```

## Build Configuration

### TypeScript:
```json
{
  "compilerOptions": {
    "module": "ESNext",
    "target": "ES2022",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "verbatimModuleSyntax": false
  }
}
```

### Build Scripts:
```json
{
  "scripts": {
    "build": "npm run build:esm && npm run build:cjs",
    "build:esm": "tsc --project tsconfig.json",
    "build:cjs": "rollup -c rollup.config.cjs.js"
  }
}
```

## Migration Path

### Phase 1: Internal ESM
- Convert all source code to ESM
- Update build system for ESM output
- Update development tooling

### Phase 2: Dual Publishing
- Add CommonJS build target
- Configure package.json exports
- Test both module formats

### Phase 3: Documentation
- Update examples and guides
- Provide migration documentation
- ESLint rules for consistent imports

## Consequences

### Positive:
- ✅ Future-proof module system
- ✅ Better performance and bundle sizes
- ✅ Improved tree-shaking
- ✅ Modern development experience
- ✅ Standards compliance

### Negative:
- ❌ Breaking change for existing CommonJS consumers
- ❌ Increased build complexity (dual publishing)
- ❌ Learning curve for team members
- ❌ Some tools may need configuration updates

### Risk Assessment:
- **High**: Breaking changes for existing users
- **Medium**: Build system complexity
- **Low**: Developer learning curve

### Mitigation:
- Semantic versioning (major version bump)
- Comprehensive migration guide
- Dual package publishing for transition period
- Community engagement and feedback

## Validation

### Testing Strategy:
```bash
# Test ESM imports
node --input-type=module --eval "import('@acme/kernel')"

# Test CJS requires  
node --eval "const kernel = require('@acme/kernel')"

# Test in different environments
npm run test:node20
npm run test:node22
npm run test:browsers
```

### Consumer Examples:
```typescript
// Modern ESM consumer
import { Entity, ValueObject } from '@acme/kernel';

// Legacy CJS consumer (transitional)
const { Entity, ValueObject } = require('@acme/kernel');

// Bundler consumer (Webpack, Vite, etc.)
import { Entity } from '@acme/kernel/Entity';
```

## References
- [Node.js ES Modules](https://nodejs.org/api/esm.html)
- [Dual Package Hazard](https://nodejs.org/api/packages.html#dual-package-hazard)
- [Package.json Exports](https://nodejs.org/api/packages.html#exports)
- [TypeScript ESM Support](https://www.typescriptlang.org/docs/handbook/esm-node.html)
