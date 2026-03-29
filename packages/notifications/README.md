# @acme/notifications

Multi-channel notification delivery: in-memory (dev/test), Webhook, and extensible via the `NotificationPort` interface. Supports rate limiting, retry, and opt-out management.

## Installation

```bash
pnpm add @acme/notifications
```

## Quick Start

```typescript
import { NotificationService, InMemoryNotificationAdapter } from '@acme/notifications';

const adapter = new InMemoryNotificationAdapter();
const service = new NotificationService(adapter);

// Send a single notification
const result = await service.send({
  channel: 'email',
  recipient: { id: 'user-123', address: 'user@example.com' },
  template: 'order-confirmed',
  data: { orderId: 'order-456', total: 99.9 },
});

// Bulk send
const bulk = await service.sendBulk(notifications);
// bulk.sent, bulk.failed, bulk.optedOut
```

## Channels

```typescript
type NotificationChannel = 'email' | 'sms' | 'push' | 'webhook' | 'in-app';
```

## Rate Limiting

```typescript
const service = new NotificationService(adapter, {
  rateLimit: { maxPerMinute: 100, maxPerHour: 500 },
});
```

## Implementing a Custom Adapter

```typescript
import type { NotificationPort, Notification, SendResult } from '@acme/notifications';

class TwilioAdapter implements NotificationPort {
  async send(notification: Notification): Promise<SendResult> {
    /* Twilio API */
  }
}
```

## See Also

- [`@acme/email`](../email) — dedicated email delivery
- [`@acme/messaging`](../messaging) — event-driven notifications
