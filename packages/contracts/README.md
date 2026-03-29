# @marcusprado02/contracts

Shared TypeScript utilities for inter-service contracts — OpenAPI spec builders, standard HTTP header constants, semantic versioning helpers, and API versioning support.

## Installation

```bash
npm install @marcusprado02/contracts
```

## Key Exports

### Compatibility

- `SemVer` — semantic version parsing, comparison, and range checks

### HTTP Headers

Standard header name constants for distributed tracing and multi-tenancy:

- `CORRELATION_ID_HEADER`
- `REQUEST_ID_HEADER`
- `IDEMPOTENCY_KEY_HEADER`
- `TENANT_ID_HEADER`

### OpenAPI

Fluent builders for constructing OpenAPI 3.x documents programmatically:

- `SchemaBuilder` — build JSON Schema objects (string, number, object, array, enum, etc.)
- `OperationBuilder` — describe an individual HTTP operation with parameters, request body, and responses
- `OpenApiSpecBuilder` — assemble a complete `OpenApiDocument` from paths, servers, and components
- OpenAPI type exports: `OpenApiDocument`, `OperationObject`, `SchemaObject`, `PathItemObject`, `HttpMethod`, and more

### Versioning

- `ApiVersion` — enumerate and compare API versions (e.g. `v1`, `v2`); useful for routing and deprecation logic

## Usage

```typescript
import { OpenApiSpecBuilder, OperationBuilder, SchemaBuilder } from '@marcusprado02/contracts';

const userSchema = new SchemaBuilder()
  .object({ id: SchemaBuilder.string(), email: SchemaBuilder.string('email') })
  .build();

const getUser = new OperationBuilder()
  .summary('Get a user by ID')
  .parameter({ name: 'id', in: 'path', required: true, schema: SchemaBuilder.string().build() })
  .response(200, {
    description: 'Success',
    content: { 'application/json': { schema: userSchema } },
  })
  .build();

const spec = new OpenApiSpecBuilder({ title: 'User API', version: '1.0.0' })
  .path('/users/{id}', { get: getUser })
  .build();
```

```typescript
import { ApiVersion, CORRELATION_ID_HEADER } from '@marcusprado02/contracts';

// Route based on version
const version = ApiVersion.from(req.params.version); // 'v1' | 'v2' ...

// Forward tracing header
res.setHeader(CORRELATION_ID_HEADER, req.headers[CORRELATION_ID_HEADER] ?? uuid());
```

## Dependencies

- `@marcusprado02/kernel` (workspace)
