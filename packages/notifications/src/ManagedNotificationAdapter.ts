import type { NotificationPort } from './NotificationPort';
import type { BulkSendResult, DeliveryRecord, Notification, SendResult } from './NotificationTypes';
import type { RateLimiter } from './RateLimiter';
import type { TemplateEngine } from './TemplateEngine';
import type { UserPreferencesStore } from './UserPreferencesStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRateLimited(rateLimiter: RateLimiter | undefined, notification: Notification): boolean {
  if (rateLimiter === undefined) return false;
  return !rateLimiter.isAllowed(notification.channel, notification.recipient.userId);
}

function isOptedOut(prefs: UserPreferencesStore | undefined, notification: Notification): boolean {
  if (prefs === undefined) return false;
  return prefs.isOptedOut(notification.recipient.userId, notification.channel);
}

function resolveBody(templates: TemplateEngine | undefined, notification: Notification): string {
  if (templates === undefined) return notification.body;
  if (notification.templateId === undefined) return notification.body;
  return templates.render(notification.templateId, notification.templateData ?? {});
}

function applyTemplate(
  templates: TemplateEngine | undefined,
  notification: Notification,
): Notification {
  const body = resolveBody(templates, notification);
  if (body === notification.body) return notification;
  return { ...notification, body };
}

function recordDelay(rateLimiter: RateLimiter | undefined, notification: Notification): void {
  if (rateLimiter !== undefined) {
    rateLimiter.record(notification.channel, notification.recipient.userId);
  }
}

function skippedResult(id: string, reason: string): SendResult {
  return { notificationId: id, status: 'skipped', failureReason: reason };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Orchestrating decorator that composes user preference opt-outs, rate limiting,
 * and template rendering on top of any inner {@link NotificationPort}.
 *
 * @example
 * ```ts
 * const adapter = new ManagedNotificationAdapter(innerAdapter, {
 *   preferences, rateLimiter, templates,
 * });
 * await adapter.send(notification);
 * ```
 */
export class ManagedNotificationAdapter implements NotificationPort {
  private readonly preferences: UserPreferencesStore | undefined;
  private readonly rateLimiter: RateLimiter | undefined;
  private readonly templates: TemplateEngine | undefined;

  constructor(
    private readonly inner: NotificationPort,
    options?: {
      readonly preferences?: UserPreferencesStore;
      readonly rateLimiter?: RateLimiter;
      readonly templates?: TemplateEngine;
    },
  ) {
    this.preferences = options?.preferences;
    this.rateLimiter = options?.rateLimiter;
    this.templates = options?.templates;
  }

  async send(notification: Notification): Promise<SendResult> {
    if (isOptedOut(this.preferences, notification)) {
      return skippedResult(notification.id, 'opted out');
    }
    if (isRateLimited(this.rateLimiter, notification)) {
      return skippedResult(notification.id, 'rate limited');
    }
    recordDelay(this.rateLimiter, notification);
    const resolved = applyTemplate(this.templates, notification);
    return this.inner.send(resolved);
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
    return this.inner.getDeliveryRecord(notificationId);
  }

  checkHealth(): Promise<boolean> {
    return this.inner.checkHealth();
  }
}
