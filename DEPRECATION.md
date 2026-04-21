# Deprecation Policy

## Versioning context

This project follows [Semantic Versioning](https://semver.org/). While on `0.x`, breaking changes
may land in any minor release. Once `1.0.0` is released, this policy is fully binding.

## What counts as deprecated

A symbol (function, class, type, constant, package) is deprecated when:

- A better replacement exists, OR
- It will be removed in the next major version.

Deprecation is **never silent** — every deprecated symbol must carry a `@deprecated` JSDoc tag.

## Deprecation lifecycle

```
Minor N   → @deprecated added, replacement documented
Minor N+1 → deprecated symbol still present (warning in lint)
Major+1   → symbol removed
```

Pre-1.0 shortcut: deprecated symbols may be removed in the **next minor** release, not the next major.
This is the only pre-1.0 exception; everything else follows the lifecycle above.

## How to deprecate a symbol

### 1. Add the JSDoc tag with migration path

```typescript
/**
 * @deprecated since 0.3.0 — use {@link newFunction} instead.
 * Will be removed in 1.0.0.
 *
 * @example
 * // Before
 * oldFunction(x);
 *
 * // After
 * newFunction(x);
 */
export function oldFunction(x: string): void { ... }
```

Required fields in `@deprecated`:

- **since** — version when deprecated (e.g. `since 0.3.0`)
- **use** — exact replacement symbol with `{@link}`
- **removed in** — target removal version

### 2. Add to CHANGELOG under `### Deprecated`

```markdown
### Deprecated

- `oldFunction` — use `newFunction` instead (#123)
```

### 3. Keep the symbol working

Deprecated symbols must remain **fully functional** until removal. Never silently no-op them.

### 4. Add removal milestone to CHANGELOG under the target version

```markdown
## [1.0.0] — Unreleased

### Removed

- `oldFunction` (deprecated since 0.3.0)
```

## Enforcement

ESLint (`eslint-plugin-deprecation`) runs on every PR and flags any **usage** of a deprecated
symbol as an error. Authors of new code must migrate to the replacement.

Run locally:

```bash
pnpm lint
# or just the deprecation check
pnpm lint:deprecation
```

## Breaking changes vs deprecation

Not everything needs a deprecation period. These are **immediately breaking** (no deprecation):

- Security fixes that require a signature change
- Removal of a symbol that was `@internal` / not in public API
- Removal of a symbol added in the **same** minor release (accidental export)

Everything else must follow the deprecation lifecycle.

## Questions

Open an issue tagged `deprecation` in the repository.
