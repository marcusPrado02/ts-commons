/** Thrown when notification delivery to the backend fails permanently. */
export class NotificationDeliveryError extends Error {
  override readonly name = 'NotificationDeliveryError';
  constructor(
    readonly notificationId: string,
    readonly channel: string,
    override readonly cause?: unknown,
  ) {
    super(`Delivery failed for notification "${notificationId}" on channel "${channel}"`);
  }
}

/** Thrown when delivery is rejected because the recipient has opted out. */
export class NotificationOptedOutError extends Error {
  override readonly name = 'NotificationOptedOutError';
  constructor(
    readonly userId: string,
    readonly channel: string,
  ) {
    super(`User "${userId}" has opted out of channel "${channel}"`);
  }
}

/** Thrown when delivery is rejected by the rate limiter. */
export class NotificationRateLimitError extends Error {
  override readonly name = 'NotificationRateLimitError';
  constructor(
    readonly channel: string,
    readonly userId: string,
  ) {
    super(`Rate limit exceeded for channel "${channel}" and user "${userId}"`);
  }
}

/** Thrown when a referenced template is not registered. */
export class NotificationTemplateNotFoundError extends Error {
  override readonly name = 'NotificationTemplateNotFoundError';
  constructor(readonly templateId: string) {
    super(`Notification template "${templateId}" is not registered`);
  }
}

/** Thrown when all retry attempts for a notification have been exhausted. */
export class NotificationMaxRetriesExceededError extends Error {
  override readonly name = 'NotificationMaxRetriesExceededError';
  constructor(
    readonly notificationId: string,
    readonly attempts: number,
    override readonly cause?: unknown,
  ) {
    super(`Max retries (${attempts}) exceeded for notification "${notificationId}"`);
  }
}
