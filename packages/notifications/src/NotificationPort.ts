import type { BulkSendResult, DeliveryRecord, Notification, SendResult } from './NotificationTypes';

/**
 * Port for multi-channel notification delivery.
 *
 * Implementations: {@link InMemoryNotificationAdapter}, {@link WebhookNotificationAdapter},
 * decorators: {@link RetryNotificationAdapter}, {@link ManagedNotificationAdapter}.
 */
export interface NotificationPort {
  /**
   * Send a single notification.
   * Must not throw — failures are represented as `SendResult.status === 'failed'`.
   */
  send(notification: Notification): Promise<SendResult>;

  /**
   * Send multiple notifications.
   * Processes each independently — partial failures are captured in `results`.
   */
  sendBulk(notifications: readonly Notification[]): Promise<BulkSendResult>;

  /**
   * Retrieve the stored delivery record for a notification by its id.
   * Returns `undefined` when no record exists.
   */
  getDeliveryRecord(notificationId: string): Promise<DeliveryRecord | undefined>;

  /** Return `true` if the backend is reachable and operational. */
  checkHealth(): Promise<boolean>;
}
