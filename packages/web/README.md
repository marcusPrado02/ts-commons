# @marcusprado02/web

Framework-agnostic web primitives — HTTP type abstractions, composable middleware, HATEOAS/HAL, JSON:API, Server-Sent Events, and Content Security Policy.

## Installation

```bash
pnpm add @marcusprado02/web
```

## Exports

### HTTP

| Export                  | Kind     | Description                                                                           |
| ----------------------- | -------- | ------------------------------------------------------------------------------------- |
| `HttpRequest`           | type     | Framework-agnostic inbound request                                                    |
| `HttpResponse`          | type     | Framework-agnostic outbound response                                                  |
| `HttpContext`           | type     | Holds `request`, `response`, and a `locals` map                                       |
| `Middleware`            | type     | `(context, next) => Promise<void>`                                                    |
| `MiddlewareChain`       | class    | Composable pipeline of `Middleware` functions                                         |
| `correlationMiddleware` | function | Reads or generates a correlation ID and injects it into `locals` and response headers |

### HATEOAS

| Export           | Kind  | Description                                                     |
| ---------------- | ----- | --------------------------------------------------------------- |
| `LinkBuilder`    | class | Constructs HAL `Link` objects (`self`, `collection`, `related`) |
| `HalResource<T>` | class | Wraps a data object with `_links` and `_embedded`               |
| `HalDocument`    | type  | Plain HAL document shape                                        |
| `JsonApiBuilder` | class | Builds JSON:API compliant documents                             |

### Server-Sent Events

| Export            | Kind  | Description                                |
| ----------------- | ----- | ------------------------------------------ |
| `SseFormatter`    | class | Serialises events to the SSE wire format   |
| `SseEmitter`      | class | Manages an SSE connection and emits events |
| `SseEventTracker` | class | Tracks last-event-ID for reconnect support |

### Content Security Policy

| Export                | Kind  | Description                                                |
| --------------------- | ----- | ---------------------------------------------------------- |
| `CspBuilder`          | class | Fluent builder for `Content-Security-Policy` header values |
| `NonceGenerator`      | class | Generates cryptographic nonces for inline scripts/styles   |
| `CspViolationMonitor` | class | Processes and aggregates CSP violation reports             |

## Usage

### Middleware pipeline

```ts
import { MiddlewareChain, correlationMiddleware } from '@marcusprado02/web';
import type { HttpContext } from '@marcusprado02/web';

const chain = new MiddlewareChain().use(correlationMiddleware()).use(async (ctx, next) => {
  console.log('incoming', ctx.request.method, ctx.request.path);
  await next();
});

// Execute against a context object provided by your framework adapter.
await chain.execute(context);
```

### HAL hypermedia response

```ts
import { HalResource, LinkBuilder } from '@marcusprado02/web';

const resource = new HalResource({ id: '42', name: 'Alice' }, 'https://api.acme.com/users/42')
  .addLink('users', LinkBuilder.collection('https://api.acme.com/users'))
  .toDocument();

// {
//   id: '42', name: 'Alice',
//   _links: {
//     self:  { href: 'https://api.acme.com/users/42' },
//     users: { href: 'https://api.acme.com/users' },
//   }
// }
```

### Content Security Policy header

```ts
import { CspBuilder, NonceGenerator } from '@marcusprado02/web';

const nonce = NonceGenerator.generate(); // cryptographic nonce

const cspHeader = new CspBuilder()
  .add('default-src', ["'none'"])
  .add('script-src', ["'self'", `'nonce-${nonce}'`])
  .add('style-src', ["'self'"])
  .add('img-src', ["'self'", 'data:'])
  .withOptions({ upgradeInsecureRequests: true, reportUri: '/csp-report' })
  .build();

// Set the header in your response:
res.setHeader('Content-Security-Policy', cspHeader);
```

## Dependencies

| Package                    | Role                                            |
| -------------------------- | ----------------------------------------------- |
| `@marcusprado02/kernel`    | Core utilities and domain primitives            |
| `@marcusprado02/errors`    | Shared error types                              |
| `@marcusprado02/contracts` | Shared constants (e.g. `CORRELATION_ID_HEADER`) |
