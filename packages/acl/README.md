# @acme/acl

Anti-Corruption Layer (ACL) helpers for integrating with legacy systems and external APIs. Provides translators, data format registries, and protocol adapters to keep your domain model clean at the boundaries.

## Installation

```bash
pnpm add @acme/acl
```

## Quick Start

```typescript
import { AntiCorruptionLayer, FunctionTranslator } from '@acme/acl';

// Translate a legacy API response to your domain model
const userTranslator = new FunctionTranslator<LegacyUser, DomainUser>((legacy) => ({
  id: legacy.user_id,
  name: legacy.full_name,
}));

const acl = new AntiCorruptionLayer();
acl.register('user', userTranslator);

const domainUser = await acl.translate('user', legacyUser);
```

## API

| Export                    | Description                                               |
| ------------------------- | --------------------------------------------------------- |
| `AntiCorruptionLayer`     | Central facade — registers and dispatches translators     |
| `FunctionTranslator`      | Wraps a plain lambda as a `Translator`                    |
| `CompositeTranslator`     | Chains multiple translators in sequence                   |
| `TranslatorRegistry`      | Keyed registry for `Translator` instances                 |
| `DataFormatRegistry`      | Registry for `DataConverter` instances (JSON ↔ CSV ↔ XML) |
| `ProtocolAdapterRegistry` | Registry for `ProtocolAdapter` instances                  |
| `LegacyFacade`            | Abstract base class for wrapping a legacy service         |
| `AclException`            | Typed error thrown on translation failures                |
| `createTranslationResult` | Factory for `TranslationResult<T>`                        |

## Concepts

- **Translator** — maps an external model to a domain model
- **DataConverter** — converts between data formats at the boundary
- **ProtocolAdapter** — bridges different transport/protocol conventions
- **LegacyFacade** — wraps an entire legacy service behind a clean interface

## See Also

- [`@acme/kernel`](../kernel) — domain primitives
- [`@acme/application`](../application) — use-case layer
