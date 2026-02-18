# @acme/web-express

Express.js adapter for the ts-commons platform. Provides middleware, adapters, and utilities for integrating Express.js with Clean Architecture patterns.

## Features

- ✅ **Correlation ID middleware** - Automatic request tracing
- ✅ **Error handling middleware** - RFC 7807 Problem Details
- ✅ **Logging middleware** - Structured HTTP logging
- ✅ **Validation middleware** - Type-safe request validation
- ✅ **Controller adapter** - Use case integration
- ✅ **Context adapter** - Request context extraction

## Installation

```bash
pnpm add @acme/web-express express
pnpm add -D @types/express
```

## Quick Start

```typescript
import express from 'express';
import {
  correlationMiddleware,
  loggingMiddleware,
  errorHandlerMiddleware,
  adaptUseCase,
} from '@acme/web-express';
import { createLogger } from '@acme/observability';
import { CreateUserUseCase } from './usecases';

const app = express();
const logger = createLogger('http');

// Apply middleware
app.use(express.json());
app.use(correlationMiddleware(logger));
app.use(loggingMiddleware(logger));

// Define routes with use case adapters
const createUserUseCase = new CreateUserUseCase();
app.post('/users', adaptUseCase(createUserUseCase, {
  successStatus: 201,
}));

// Error handler (must be last)
app.use(errorHandlerMiddleware(logger));

app.listen(3000, () => {
  logger.info('Server started on port 3000');
});
```

## Middleware

### Correlation Middleware

Automatically creates or extracts correlation IDs from requests:

```typescript
import { correlationMiddleware } from '@acme/web-express';

app.use(correlationMiddleware(logger));

// Access in routes
app.get('/users', (req, res) => {
  console.log(req.correlationId?.value);
  res.json({ users: [] });
});
```

### Logging Middleware

Structured HTTP request/response logging:

```typescript
import { loggingMiddleware, advancedLoggingMiddleware } from '@acme/web-express';

// Basic logging
app.use(loggingMiddleware(logger));

// Advanced with options
app.use(advancedLoggingMiddleware(logger, {
  logBody: true,
  excludePaths: ['/health', '/metrics'],
  maxBodySize: 500,
}));
```

### Error Handler Middleware

Converts errors to RFC 7807 Problem Details:

```typescript
import { errorHandlerMiddleware } from '@acme/web-express';

// Must be registered as last middleware
app.use(errorHandlerMiddleware(logger));
```

### Validation Middleware

Type-safe request validation:

```typescript
import { validateBody, createZodValidator } from '@acme/web-express';
import { z } from 'zod';

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().min(18),
});

app.post('/users',
  validateBody(createZodValidator(createUserSchema)),
  async (req, res) => {
    // req.body is now typed and validated
    const user = await createUser(req.body);
    res.status(201).json(user);
  }
);
```

## Adapters

### Controller Adapter

Adapt use cases to Express request handlers:

```typescript
import { ExpressControllerAdapter } from '@acme/web-express';

// Basic adaptation
app.post('/users', ExpressControllerAdapter.adapt(createUserUseCase, {
  successStatus: 201,
  extractInput: (req) => req.body,
}));

// Command adaptation (returns 204 No Content)
app.delete('/users/:id',
  ExpressControllerAdapter.adaptCommand(deleteUserUseCase, {
    extractInput: (req) => ({ userId: req.params.id }),
  })
);

// Query adaptation (extracts from params + query)
app.get('/users/:id',
  ExpressControllerAdapter.adaptQuery(getUserUseCase)
);

// Creation adaptation (returns 201 Created)
app.post('/users',
  ExpressControllerAdapter.adaptCreate(createUserUseCase)
);
```

### Context Adapter

Extract use case context from requests:

```typescript
import { ExpressContextAdapter } from '@acme/web-express';

// Create context from request
app.use((req, res, next) => {
  const context = ExpressContextAdapter.fromRequest(req);
  // Use context in use cases
  next();
});

// Or use middleware
app.use(ExpressContextAdapter.contextMiddleware());
```

## Complete Example

```typescript
import express from 'express';
import {
  correlationMiddleware,
  loggingMiddleware,
  errorHandlerMiddleware,
  validateBody,
  createZodValidator,
  ExpressControllerAdapter,
} from '@acme/web-express';
import { createLogger } from '@acme/observability';
import { z } from 'zod';

const app = express();
const logger = createLogger('api');

// Middleware stack
app.use(express.json());
app.use(correlationMiddleware(logger));
app.use(loggingMiddleware(logger));

// Validation schema
const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

// Routes with validation and use case adaptation
app.post('/users',
  validateBody(createZodValidator(createUserSchema)),
  ExpressControllerAdapter.adaptCreate(createUserUseCase)
);

app.get('/users/:id',
  ExpressControllerAdapter.adaptQuery(getUserUseCase)
);

app.put('/users/:id',
  validateBody(createZodValidator(updateUserSchema)),
  ExpressControllerAdapter.adapt(updateUserUseCase)
);

app.delete('/users/:id',
  ExpressControllerAdapter.adaptDelete(deleteUserUseCase, {
    extractInput: (req) => ({ userId: req.params.id }),
  })
);

// Error handler (must be last)
app.use(errorHandlerMiddleware(logger));

// Start server
const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
});
```

## Architecture

This package follows Clean Architecture principles:

```
┌─────────────────────────────────────┐
│      Express.js (Framework)         │
│  ┌───────────────────────────────┐  │
│  │   @acme/web-express           │  │
│  │   (Adapter Layer)             │  │
│  │  • Middleware                 │  │
│  │  • Controller Adapter         │  │
│  │  • Context Adapter            │  │
│  └──────────┬────────────────────┘  │
└─────────────┼───────────────────────┘
              │
┌─────────────▼───────────────────────┐
│     Application Layer                │
│  • Use Cases                         │
│  • Commands / Queries                │
│  • Handlers                          │
└──────────────────────────────────────┘
```

## Best Practices

1. **Middleware order matters**:
   ```typescript
   app.use(express.json());              // 1. Body parsing
   app.use(correlationMiddleware());     // 2. Correlation ID
   app.use(loggingMiddleware());         // 3. Logging
   // ... routes ...
   app.use(errorHandlerMiddleware());    // Last: Error handling
   ```

2. **Use validation early**:
   ```typescript
   app.post('/users',
     validateBody(validator),  // Validate first
     adaptUseCase(useCase)     // Then execute
   );
   ```

3. **Leverage type safety**:
   ```typescript
   const schema = z.object({ ... });
   type CreateUserDto = z.infer<typeof schema>;
   
   app.post('/users',
     validateBody(createZodValidator(schema)),
     (req: Request<{}, {}, CreateUserDto>, res) => {
       // req.body is fully typed
     }
   );
   ```

4. **Separate concerns**:
   - Middleware: Cross-cutting concerns (logging, errors)
   - Controllers: HTTP → Use Case adaptation
   - Use Cases: Business logic (framework-agnostic)

## License

MIT
