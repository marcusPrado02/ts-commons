import type { NotificationPort } from './NotificationPort';
import type {
  BulkSendResult,
  DeliveryRecord,
  DeliveryStatus,
  Notification,
  SendResult,
} from './NotificationTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRecord(
  notification: Notification,
  status: DeliveryStatus,
  failureReason?: string,
): DeliveryRecord {
  return {
    notificationId: notification.id,
    channel: notification.channel,
    recipientId: notification.recipient.userId,
    status,
    ...(status === 'sent' ? { sentAtMs: Date.now() } : {}),
    ...(failureReason === undefined ? {} : { failureReason }),
  };
}

function buildSendResult(record: DeliveryRecord): SendResult {
  return {
    notificationId: record.notificationId,
    status: record.status,
    ...(record.failureReason === undefined ? {} : { failureReason: record.failureReason }),
  };
}

function aggregateBulk(results: readonly SendResult[]): BulkSendResult {
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

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * In-memory notification adapter that records every delivery attempt.
 *
 * Simulates successful delivery for all sent notifications. Useful for testing
 * and local development.
 *
 * Optional `failChannels` set causes deliveries on those channels to be marked
 * as `failed` — useful for simulating failures in tests.
 *
 * @example
 * ```ts
 * const adapter = new InMemoryNotificationAdapter();
 * await adapter.send({ id: 'n1', channel: 'email', recipient: { userId: 'u1' }, body: 'Hi!' });
 * const record = await adapter.getDeliveryRecord('n1');
 * // record.status === 'sent'
 * ```
 */
export class InMemoryNotificationAdapter implements NotificationPort {
  private readonly records = new Map<string, DeliveryRecord>();
  private readonly failChannels: ReadonlySet<string>;

  constructor(failChannels: ReadonlySet<string> = new Set()) {
    this.failChannels = failChannels;
  }

  send(notification: Notification): Promise<SendResult> {
    const shouldFail = this.failChannels.has(notification.channel);
    const status: DeliveryStatus = shouldFail ? 'failed' : 'sent';
    const failureReason = shouldFail ? 'simulated failure' : undefined;
    const record = buildRecord(notification, status, failureReason);
    this.records.set(notification.id, record);
    return Promise.resolve(buildSendResult(record));
  }

  sendBulk(notifications: readonly Notification[]): Promise<BulkSendResult> {
    const results: SendResult[] = [];
    for (const n of notifications) {
      const shouldFail = this.failChannels.has(n.channel);
      const status: DeliveryStatus = shouldFail ? 'failed' : 'sent';
      const failureReason = shouldFail ? 'simulated failure' : undefined;
      const record = buildRecord(n, status, failureReason);
      this.records.set(n.id, record);
      results.push(buildSendResult(record));
    }
    return Promise.resolve(aggregateBulk(results));
  }

  getDeliveryRecord(notificationId: string): Promise<DeliveryRecord | undefined> {
    return Promise.resolve(this.records.get(notificationId));
  }

  checkHealth(): Promise<boolean> {
    return Promise.resolve(true);
  }

  /** Return all stored delivery records. Useful for assertions in tests. */
  getAllRecords(): readonly DeliveryRecord[] {
    return [...this.records.values()];
  }

  /** Clear all stored delivery records. */
  clear(): void {
    this.records.clear();
  }
}
