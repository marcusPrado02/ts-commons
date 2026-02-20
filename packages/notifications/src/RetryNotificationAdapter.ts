import { NotificationMaxRetriesExceededError } from './NotificationErrors';
import type { NotificationPort } from './NotificationPort';
import type { BulkSendResult, DeliveryRecord, Notification, SendResult } from './NotificationTypes';

// ---------------------------------------------------------------------------
// Delay function (injectable for testing)
// ---------------------------------------------------------------------------

export type DelayFn = (ms: number) => Promise<void>;

const defaultDelay: DelayFn = (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeBackoff(attempt: number, baseMs: number): number {
  return baseMs * 2 ** attempt;
}

async function attemptSend(
  inner: NotificationPort,
  notification: Notification,
  maxRetries: number,
  baseBackoffMs: number,
  delay: DelayFn,
): Promise<SendResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await inner.send(notification);
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await delay(computeBackoff(attempt, baseBackoffMs));
      }
    }
  }
  throw new NotificationMaxRetriesExceededError(notification.id, maxRetries + 1, lastError);
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Decorator that retries failed notification deliveries with exponential backoff.
 *
 * Wraps any {@link NotificationPort}. Each `send` attempt that throws is retried
 * up to `maxRetries` times. When all attempts are exhausted,
 * {@link NotificationMaxRetriesExceededError} is thrown.
 *
 * Note: delegating to `inner.sendBulk` is intentional — bulk remains unretried
 * at the adapter level; individual items that fail are handled by `send`.
 *
 * @example
 * ```ts
 * const adapter = new RetryNotificationAdapter(webhookAdapter, { maxRetries: 3, baseBackoffMs: 100 });
 * await adapter.send(notification);
 * ```
 */
export class RetryNotificationAdapter implements NotificationPort {
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly delay: DelayFn;

  constructor(
    private readonly inner: NotificationPort,
    options?: {
      readonly maxRetries?: number;
      readonly baseBackoffMs?: number;
      readonly delay?: DelayFn;
    },
  ) {
    this.maxRetries = options?.maxRetries ?? 3;
    this.baseBackoffMs = options?.baseBackoffMs ?? 100;
    this.delay = options?.delay ?? defaultDelay;
  }

  async send(notification: Notification): Promise<SendResult> {
    return attemptSend(this.inner, notification, this.maxRetries, this.baseBackoffMs, this.delay);
  }

  sendBulk(notifications: readonly Notification[]): Promise<BulkSendResult> {
    return this.inner.sendBulk(notifications);
  }

  getDeliveryRecord(notificationId: string): Promise<DeliveryRecord | undefined> {
    return this.inner.getDeliveryRecord(notificationId);
  }

  checkHealth(): Promise<boolean> {
    return this.inner.checkHealth();
  }
}
