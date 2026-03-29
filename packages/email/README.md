# @acme/email

Email sending abstraction — a provider-agnostic `EmailPort` interface with in-memory and logging adapters for testing and development.

## Installation

```bash
pnpm add @acme/email
```

## Exports

### Core types

| Export            | Kind      | Description                                                                   |
| ----------------- | --------- | ----------------------------------------------------------------------------- |
| `EmailPort`       | interface | Abstract sender: `send`, `sendBatch`, `checkHealth`                           |
| `EmailMessage`    | type      | Fully formed sendable message                                                 |
| `EmailAddress`    | type      | `{ email: string; name?: string }`                                            |
| `EmailAttachment` | type      | File to attach, supports inline (`cid:`) dispositions                         |
| `SendEmailResult` | type      | Result of a successful send (`messageId`, `provider`, `accepted`, `rejected`) |

### Errors

| Export                 | Kind  | Description                                        |
| ---------------------- | ----- | -------------------------------------------------- |
| `EmailValidationError` | class | Structurally invalid message (field + reason)      |
| `EmailSendError`       | class | Non-retryable provider send failure                |
| `EmailProviderError`   | class | Fatal provider/transport error (e.g. auth failure) |
| `EmailAttachmentError` | class | Attachment processing failure                      |

### Adapters

| Export                 | Kind  | Description                                              |
| ---------------------- | ----- | -------------------------------------------------------- |
| `InMemoryEmailAdapter` | class | Stores sent messages in memory; use in unit tests        |
| `LoggingEmailAdapter`  | class | Logs emails to a `LoggerPort` instead of delivering them |

### Tracking

| Export                 | Kind  | Description                                                           |
| ---------------------- | ----- | --------------------------------------------------------------------- |
| `InMemoryEmailTracker` | class | Records lifecycle events (`sent`, `delivered`, `opened`, …) in memory |

### Template engine

| Export                   | Kind  | Description                                          |
| ------------------------ | ----- | ---------------------------------------------------- |
| `InMemoryTemplateEngine` | class | Registers and renders string templates; use in tests |

## Usage

### Send an email (production)

```ts
import type { EmailPort, EmailMessage } from '@acme/email';

// Inject a real adapter (e.g. SmtpEmailAdapter, SendGridEmailAdapter)
// via dependency injection; accept the EmailPort interface.
async function sendWelcome(mailer: EmailPort, userEmail: string): Promise<void> {
  const message: EmailMessage = {
    from: { email: 'no-reply@acme.dev', name: 'Acme' },
    to: [{ email: userEmail }],
    subject: 'Welcome to Acme',
    text: 'Thanks for signing up.',
    html: '<p>Thanks for signing up.</p>',
  };

  const result = await mailer.send(message);
  console.log('Sent with id:', result.messageId);
}
```

### Test with InMemoryEmailAdapter

```ts
import { InMemoryEmailAdapter } from '@acme/email';

const mailer = new InMemoryEmailAdapter();

await sendWelcome(mailer, 'alice@example.com');

const sent = mailer.getSentEmailsTo('alice@example.com');
expect(sent).toHaveLength(1);
expect(sent[0]?.subject).toBe('Welcome to Acme');

// Reset between tests
mailer.clear();
```

### Track lifecycle events with InMemoryEmailTracker

```ts
import { InMemoryEmailTracker } from '@acme/email';

const tracker = new InMemoryEmailTracker();

tracker.record({ messageId: 'msg-1', event: 'sent', timestamp: new Date() });
tracker.record({ messageId: 'msg-1', event: 'delivered', timestamp: new Date() });
tracker.record({ messageId: 'msg-1', event: 'opened', timestamp: new Date() });

const stats = tracker.getStats();
// { sent: 1, delivered: 1, opened: 1, clicked: 0, bounced: 0, ... }

const events = tracker.getEvents('msg-1'); // all three events above
```

## Dependencies

| Package        | Role                                                                |
| -------------- | ------------------------------------------------------------------- |
| `@acme/kernel` | Core utilities including `LoggerPort` used by `LoggingEmailAdapter` |
