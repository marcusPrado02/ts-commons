# @marcusprado02/resilience

Padrões de **fault tolerance** e resiliência para microserviços distribuídos.

## Instalação

```bash
pnpm add @marcusprado02/resilience
```

## Features

- ⏱️ **Timeout** - Limita tempo de execução
- 🔄 **Retry** - Retentar operações com backoff
- 🔌 **Circuit Breaker** - Previne cascading failures
- 🚦 **Rate Limiter** - Token bucket rate limiting
- 💪 **Production-ready** - Testado em alta carga

## Timeout

```typescript
import { Timeout } from '@marcusprado02/resilience';

try {
  const result = await Timeout.execute(
    async () => {
      return await slowExternalApi();
    },
    5000, // 5 segundos
  );
} catch (error) {
  if (error instanceof TimeoutError) {
    console.log('Operation timed out after 5s');
  }
}
```

## Retry com Exponential Backoff

```typescript
import { Retry } from '@marcusprado02/resilience';

const result = await Retry.execute(
  async () => {
    return await unreliableService();
  },
  {
    maxAttempts: 3,
    delayMs: 1000,
    backoffMultiplier: 2, // 1s, 2s, 4s
    maxDelayMs: 10000, // Máximo 10s
  },
);
```

## Circuit Breaker

```typescript
import { CircuitBreaker } from '@marcusprado02/resilience';

const breaker = new CircuitBreaker(
  5, // Abre após 5 falhas
  30000, // Tenta novamente após 30s
);

try {
  const result = await breaker.execute(async () => {
    return await externalService();
  });
} catch (error) {
  if (error instanceof CircuitBreakerOpenError) {
    console.log('Circuit breaker is open, failing fast');
  }
}

// Monitorar estado
console.log(breaker.getState()); // CLOSED | OPEN | HALF_OPEN
```

## Rate Limiter (Token Bucket)

```typescript
import { RateLimiter } from '@marcusprado02/resilience';

const limiter = new RateLimiter(
  100, // 100 tokens máximo
  10, // 10 tokens por segundo
);

async function handleRequest() {
  const allowed = await limiter.acquire(1);

  if (!allowed) {
    throw new Error('Rate limit exceeded');
  }

  // Processar request
}
```

## Combinando Patterns

```typescript
import { Timeout, Retry, CircuitBreaker } from '@marcusprado02/resilience';

const breaker = new CircuitBreaker(5, 30000);

async function callExternalApi() {
  return await Retry.execute(
    async () => {
      return await Timeout.execute(
        async () => {
          return await breaker.execute(async () => {
            return await fetch('https://api.example.com');
          });
        },
        5000, // Timeout de 5s
      );
    },
    { maxAttempts: 3, delayMs: 1000 },
  );
}
```

## Use Cases

| Pattern             | Quando Usar                          |
| ------------------- | ------------------------------------ |
| **Timeout**         | Toda chamada externa (HTTP, DB, etc) |
| **Retry**           | Erros temporários (rede, timeout)    |
| **Circuit Breaker** | Proteger serviços downstream         |
| **Rate Limiter**    | Proteger APIs públicas               |

## Best Practices

### ✅ DO

- Use timeout em TODAS chamadas externas
- Configure retry apenas para erros retriable
- Monitore estado do circuit breaker -ログ quando circuit breaker abre

### ❌ DON'T

- Não retry erros 4xx (cliente)
- Não use retry sem timeout
- Não ignore erros de circuit breaker open
