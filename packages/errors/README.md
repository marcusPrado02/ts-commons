# @acme/errors

Error handling padronizado com **Problem Details (RFC 7807)**, taxonomy de erros, e mapeamento para HTTP.

## Instalação

```bash
pnpm add @acme/errors
```

## Features

- 📋 **Problem Details (RFC 7807)** - Formato padronizado de erros HTTP
- 🏷️ **Error Taxonomy** - Classificação de erros (retryable/non-retryable)
- 🔄 **HTTP Error Mapping** - Converte domain errors em HTTP responses
- 🎯 **Type-safe** - Erros tipados em TypeScript

## Uso

### Problem Details

```typescript
import { ProblemDetailsBuilder, ProblemType } from '@acme/errors';

const problem = ProblemDetailsBuilder
  .create(ProblemType.NOT_FOUND, 'Resource Not Found', 404)
  .withDetail('Order with ID 123 not found')
  .withInstance('/orders/123')
  .withCorrelationId('abc-123')
  .build();

// Response:
// {
//   "type": "https://httpstatuses.com/404",
//   "title": "Resource Not Found",
//   "status": 404,
//   "detail": "Order with ID 123 not found",
//   "instance": "/orders/123",
//   "correlationId": "abc-123"
// }
```

### Error Taxonomy

```typescript
import { RetryableError, NonRetryableError, AppErrorCode } from '@acme/errors';

// Erro que pode ser retentado
throw new RetryableError(
  'Database connection failed',
  AppErrorCode.DATABASE_ERROR
);

// Erro que NÃO deve ser retentado
throw new NonRetryableError(
  'Invalid input',
  AppErrorCode.VALIDATION_ERROR
);
```

### HTTP Error Mapper

```typescript
import { HttpErrorMapper } from '@acme/errors';
import { NotFoundError } from '@acme/kernel';

try {
  // ... código que pode lançar domain errors
  throw new NotFoundError('Order', '123');
} catch (error) {
  const problemDetails = HttpErrorMapper.toProblemDetails(error);
  // Retornar como HTTP response
  res.status(problemDetails.status).json(problemDetails);
}
```

## Integração com Frameworks

### Fastify

```typescript
import { HttpErrorMapper } from '@acme/errors';

fastify.setErrorHandler((error, request, reply) => {
  const problem = HttpErrorMapper.toProblemDetails(error);
  reply.status(problem.status).send(problem);
});
```

### Express

```typescript
app.use((error, req, res, next) => {
  const problem = HttpErrorMapper.toProblemDetails(error);
  res.status(problem.status).json(problem);
});
```
