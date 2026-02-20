/** Communication channel through which a notification is delivered. */
export type NotificationChannel = 'email' | 'sms' | 'push' | 'webhook';

/** Delivery state of a single notification attempt. */
export type DeliveryStatus = 'pending' | 'sent' | 'failed' | 'skipped';

/** Contact details for a notification recipient. */
export interface NotificationRecipient {
  readonly userId: string;
  readonly email?: string;
  readonly phone?: string;
  readonly pushToken?: string;
  readonly webhookUrl?: string;
}

/**
 * A single notification to be delivered through one channel.
 * `body` may contain `{{variable}}` placeholders resolved by {@link TemplateEngine}.
 */
export interface Notification {
  readonly id: string;
  readonly channel: NotificationChannel;
  readonly recipient: NotificationRecipient;
  /** Subject line (primarily for email). */
  readonly subject?: string;
  /** Notification body text; may contain template placeholders. */
  readonly body: string;
  /** Optional reference to a registered template (overrides `body`). */
  readonly templateId?: string;
  /** Data map passed to the template engine for placeholder substitution. */
  readonly templateData?: Readonly<Record<string, string>>;
  /** Arbitrary metadata attached for tracking or debugging. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Record of a single delivery attempt stored for tracking purposes. */
export interface DeliveryRecord {
  readonly notificationId: string;
  readonly channel: NotificationChannel;
  readonly recipientId: string;
  readonly status: DeliveryStatus;
  readonly sentAtMs?: number;
  readonly failureReason?: string;
}

/** Outcome of a single `send` call. */
export interface SendResult {
  readonly notificationId: string;
  readonly status: DeliveryStatus;
  readonly failureReason?: string;
}

/** Aggregated outcome of a `sendBulk` call. */
export interface BulkSendResult {
  readonly sent: number;
  readonly failed: number;
  readonly skipped: number;
  readonly results: readonly SendResult[];
}

/** Per-channel rate-limit configuration. */
export interface RateLimitConfig {
  /** Rolling window size in milliseconds. */
  readonly windowMs: number;
  /** Maximum notifications allowed within the window. */
  readonly maxCount: number;
}
