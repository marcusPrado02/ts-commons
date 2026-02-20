// Types
export type {
  BulkSendResult,
  DeliveryRecord,
  DeliveryStatus,
  Notification,
  NotificationChannel,
  NotificationRecipient,
  RateLimitConfig,
  SendResult,
} from './NotificationTypes';

// Port
export type { NotificationPort } from './NotificationPort';

// Errors
export {
  NotificationDeliveryError,
  NotificationMaxRetriesExceededError,
  NotificationOptedOutError,
  NotificationRateLimitError,
  NotificationTemplateNotFoundError,
} from './NotificationErrors';

// Utilities
export { RateLimiter } from './RateLimiter';
export { TemplateEngine } from './TemplateEngine';
export { UserPreferencesStore } from './UserPreferencesStore';

// Adapters
export { InMemoryNotificationAdapter } from './InMemoryNotificationAdapter';
export type { WebhookHttpClientLike, WebhookPayload } from './WebhookNotificationAdapter';
export { WebhookNotificationAdapter } from './WebhookNotificationAdapter';
export type { DelayFn } from './RetryNotificationAdapter';
export { RetryNotificationAdapter } from './RetryNotificationAdapter';
export { ManagedNotificationAdapter } from './ManagedNotificationAdapter';
