# @marcusprado02/resilience

Patterns for fault tolerance: Circuit Breaker, Retry, Rate Limiter, Bulkhead, and Timeout. All composable and injectable.

**Install:** `pnpm add @marcusprado02/resilience @marcusprado02/kernel`

---

## `CircuitBreaker`

Prevents cascading failures. Opens after N consecutive failures; automatically recovers.

```typescript
import { CircuitBreaker } from '@marcusprado02/resilience';

const breaker = new CircuitBreaker({
  name: 'payment-service',
  failureThreshold: 5, // open after 5 consecutive failures
  successThreshold: 2, // close again after 2 consecutive successes
  halfOpenTimeout: 10_000, // wait 10s before testing in HALF-OPEN state
});

const result = await breaker.execute(async () => {
  return paymentService.charge(amount);
});
// Throws CircuitOpenError immediately when the breaker is open
```

States: `CLOSED` (normal) → `OPEN` (failing fast) → `HALF-OPEN` (testing recovery) → `CLOSED`

---

## `Retry`

Retries on transient failures with configurable backoff.

```typescript
import { Retry } from '@marcusprado02/resilience';

const retry = new Retry({
  maxAttempts: 3,
  delayMs: 1_000,
  backoffFactor: 2, // exponential: 1s, 2s, 4s
  jitter: true, // add random jitter to avoid thundering herd
  retryOn: (err) => err instanceof NetworkError || err instanceof TimeoutError,
});

const result = await retry.execute(() => httpClient.get('/orders'));
// Throws after all attempts exhausted
```

---

## `RateLimiter`

Limits requests per time window. Useful in HTTP middleware.

```typescript
import { RateLimiter } from '@marcusprado02/resilience';

const limiter = new RateLimiter({
  limit: 100, // 100 requests
  windowMs: 60_000, // per minute
  keyFn: (req) => req.ip, // rate-limit per IP (or per user, per route, etc.)
});

// In Fastify / Express middleware
app.use(async (req, res, next) => {
  const allowed = await limiter.tryAcquire(req.ip);
  if (!allowed) {
    return res.status(429).json({ error: 'Too Many Requests' });
  }
  next();
});
```

---

## `Bulkhead` — Resource Isolation

Limits concurrent executions to prevent one slow dependency from saturating all threads.

```typescript
import { Bulkhead } from '@marcusprado02/resilience';

const bulkhead = new Bulkhead({
  maxConcurrent: 10, // at most 10 simultaneous calls
  maxQueueSize: 20, // queue up to 20 waiting callers
});

const result = await bulkhead.execute(() => externalService.call(payload));
// Throws BulkheadFullError when queue is full
```

---

## `Timeout`

Cancels an operation after a deadline.

```typescript
import { Timeout } from '@marcusprado02/resilience';

const timeout = new Timeout({ timeoutMs: 5_000 });

const result = await timeout.execute(async () => {
  return await slowExternalService.call();
});
// Throws TimeoutError after 5 seconds
```

---

## Composing Patterns

Layer the patterns from innermost (what you actually call) to outermost (what wraps everything):

```typescript
// Recommended layering: timeout → retry → circuit-breaker → actual call
const callPayment = (payload: unknown) =>
  timeout.execute(() => retry.execute(() => breaker.execute(() => paymentService.charge(payload))));
```

---

## With Bulkhead and Rate Limiter

```typescript
const callPayment = (payload: unknown) =>
  rateLimiter.tryAcquire('payment-service').then((allowed) => {
    if (!allowed) throw new RateLimitError();
    return bulkhead.execute(() =>
      timeout.execute(() =>
        retry.execute(() => breaker.execute(() => paymentService.charge(payload))),
      ),
    );
  });
```

---

## Summary

| Export              | Purpose                                 |
| ------------------- | --------------------------------------- |
| `CircuitBreaker`    | Fail-fast after threshold; auto-recover |
| `Retry`             | Retry with exponential backoff + jitter |
| `RateLimiter`       | Token-bucket rate limiting per key      |
| `Bulkhead`          | Concurrent-call cap with wait queue     |
| `Timeout`           | Cancel after deadline                   |
| `CircuitOpenError`  | Thrown when circuit is open             |
| `TimeoutError`      | Thrown when timeout expires             |
| `BulkheadFullError` | Thrown when bulkhead queue is full      |
