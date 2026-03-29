# @acme/audit

Audit trail port and adapters. Records who did what, when, and on which entity — essential for compliance, debugging, and governance.

## Installation

```bash
pnpm add @acme/audit
```

## Quick Start

```typescript
import { AuditService, InMemoryAuditStorage } from '@acme/audit';

const storage = new InMemoryAuditStorage();
const audit = new AuditService(storage);

// Log an action
await audit.log({
  action: 'UPDATE',
  entityType: 'User',
  entityId: 'user-123',
  actorId: 'admin-456',
  changes: [{ field: 'email', before: 'old@example.com', after: 'new@example.com' }],
});

// Query history
const logs = await audit.query({ entityType: 'User', entityId: 'user-123' });
```

## API

| Export                 | Description                                               |
| ---------------------- | --------------------------------------------------------- |
| `AuditService`         | Core service — writes and queries audit logs              |
| `InMemoryAuditStorage` | In-memory adapter (dev / testing)                         |
| `ComplianceReporter`   | Generates compliance reports from audit data              |
| `createAuditedFn`      | Decorator utility to auto-log any async function call     |
| `AuditStoragePort`     | Interface to implement for custom backends (DB, S3, etc.) |
| `AuditStorageError`    | Thrown when the storage backend fails                     |
| `AuditQueryError`      | Thrown when a query is malformed                          |

## Implementing a Custom Backend

```typescript
import type { AuditStoragePort, AuditLog, AuditLogInput, AuditQuery } from '@acme/audit';

class PostgresAuditStorage implements AuditStoragePort {
  async append(entry: AuditLogInput): Promise<AuditLog> {
    /* ... */
  }
  async query(q: AuditQuery): Promise<AuditLog[]> {
    /* ... */
  }
}
```

## See Also

- [`@acme/observability`](../observability) — logging and metrics
- [`@acme/security`](../security) — authentication and RBAC
