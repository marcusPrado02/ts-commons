import type { NotificationPort } from './NotificationPort';
import type { BulkSendResult, DeliveryRecord, Notification, SendResult } from './NotificationTypes';

// ---------------------------------------------------------------------------
// HTTP client interface  (mirrors the minimal Fetch/Axios surface needed)
// ---------------------------------------------------------------------------

export interface WebhookHttpClientLike {
  post(url: string, payload: unknown): Promise<{ readonly status: number }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export interface WebhookPayload {
  readonly notificationId: string;
  readonly channel: 'webhook';
  readonly recipientId: string;
  readonly subject?: string;
  readonly body: string;
  readonly sentAtMs: number;
}

function buildPayload(notification: Notification): WebhookPayload {
  return {
    notificationId: notification.id,
    channel: 'webhook',
    recipientId: notification.recipient.userId,
    ...(notification.subject === undefined ? {} : { subject: notification.subject }),
    body: notification.body,
    sentAtMs: Date.now(),
  };
}

function buildResult(id: string, status: number): SendResult {
  const isSuccess = status >= 200 && status < 300;
  return {
    notificationId: id,
    status: isSuccess ? 'sent' : 'failed',
    ...(isSuccess ? {} : { failureReason: `HTTP ${status}` }),
  };
}

function recordFromResult(notification: Notification, result: SendResult): DeliveryRecord {
  return {
    notificationId: notification.id,
    channel: notification.channel,
    recipientId: notification.recipient.userId,
    status: result.status,
    ...(result.status === 'sent' ? { sentAtMs: Date.now() } : {}),
    ...(result.failureReason === undefined ? {} : { failureReason: result.failureReason }),
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Notification adapter that delivers messages to an HTTP webhook endpoint.
 *
 * The `webhookUrl` is taken from `notification.recipient.webhookUrl` at send
 * time. If no URL is present the notification is marked as `failed`.
 *
 * @example
 * ```ts
 * const adapter = new WebhookNotificationAdapter(httpClient);
 * await adapter.send({
 *   id: 'n1', channel: 'webhook',
 *   recipient: { userId: 'u1', webhookUrl: 'https://hooks.example.com/notify' },
 *   body: 'Order shipped!',
 * });
 * ```
 */
export class WebhookNotificationAdapter implements NotificationPort {
  private readonly records = new Map<string, DeliveryRecord>();

  constructor(private readonly client: WebhookHttpClientLike) {}

  async send(notification: Notification): Promise<SendResult> {
    const url = notification.recipient.webhookUrl;
    if (url === undefined) {
      const result: SendResult = {
        notificationId: notification.id,
        status: 'failed',
        failureReason: 'no webhookUrl',
      };
      this.records.set(notification.id, recordFromResult(notification, result));
      return result;
    }
    const payload = buildPayload(notification);
    const { status } = await this.client.post(url, payload);
    const result = buildResult(notification.id, status);
    this.records.set(notification.id, recordFromResult(notification, result));
    return result;
  }

  async sendBulk(notifications: readonly Notification[]): Promise<BulkSendResult> {
    const results: SendResult[] = [];
    for (const n of notifications) results.push(await this.send(n));
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const r of results) {
      if (r.status === 'sent') sent++;
      else if (r.status === 'failed') failed++;
      else skipped++;
    }
    return { sent, failed, skipped, results };
  }

  getDeliveryRecord(notificationId: string): Promise<DeliveryRecord | undefined> {
    return Promise.resolve(this.records.get(notificationId));
  }

  checkHealth(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
