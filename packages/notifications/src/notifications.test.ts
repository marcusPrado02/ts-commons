import { describe, expect, it, vi } from 'vitest';
import {
  InMemoryNotificationAdapter,
  ManagedNotificationAdapter,
  NotificationDeliveryError,
  NotificationMaxRetriesExceededError,
  NotificationOptedOutError,
  NotificationRateLimitError,
  NotificationTemplateNotFoundError,
  RateLimiter,
  RetryNotificationAdapter,
  TemplateEngine,
  UserPreferencesStore,
  WebhookNotificationAdapter,
} from './index';
import type { Notification, NotificationPort } from './index';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeNotification(overrides?: Partial<Notification>): Notification {
  return {
    id: 'n1',
    channel: 'email',
    recipient: { userId: 'u1', email: 'user@example.com' },
    body: 'Hello World',
    ...overrides,
  };
}

function makeWebhookNotification(overrides?: Partial<Notification>): Notification {
  return makeNotification({
    id: 'wh1',
    channel: 'webhook',
    recipient: { userId: 'u1', webhookUrl: 'https://hooks.example.com' },
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// NotificationErrors
// ---------------------------------------------------------------------------

describe('NotificationErrors', () => {
  it('NotificationDeliveryError stores fields', () => {
    const err = new NotificationDeliveryError('n1', 'email');
    expect(err).toBeInstanceOf(NotificationDeliveryError);
    expect(err.notificationId).toBe('n1');
    expect(err.channel).toBe('email');
    expect(err.message).toContain('n1');
  });

  it('NotificationDeliveryError propagates cause', () => {
    const cause = new Error('timeout');
    const err = new NotificationDeliveryError('n2', 'sms', cause);
    expect(err.cause).toBe(cause);
  });

  it('NotificationOptedOutError stores userId and channel', () => {
    const err = new NotificationOptedOutError('u1', 'push');
    expect(err.userId).toBe('u1');
    expect(err.channel).toBe('push');
  });

  it('NotificationRateLimitError stores fields', () => {
    const err = new NotificationRateLimitError('email', 'u2');
    expect(err.channel).toBe('email');
    expect(err.userId).toBe('u2');
  });

  it('NotificationTemplateNotFoundError stores templateId', () => {
    const err = new NotificationTemplateNotFoundError('tmpl-missing');
    expect(err.templateId).toBe('tmpl-missing');
    expect(err.message).toContain('tmpl-missing');
  });

  it('NotificationMaxRetriesExceededError stores attempts', () => {
    const err = new NotificationMaxRetriesExceededError('n3', 3);
    expect(err.notificationId).toBe('n3');
    expect(err.attempts).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// TemplateEngine
// ---------------------------------------------------------------------------

describe('TemplateEngine', () => {
  it('renders a registered template with data', () => {
    const engine = new TemplateEngine();
    engine.register('welcome', 'Hello {{name}}!');
    expect(engine.render('welcome', { name: 'Alice' })).toBe('Hello Alice!');
  });

  it('throws on unknown template', () => {
    const engine = new TemplateEngine();
    expect(() => engine.render('missing')).toThrow(NotificationTemplateNotFoundError);
  });

  it('has() returns true for registered templates', () => {
    const engine = new TemplateEngine();
    engine.register('greet', 'Hi {{name}}');
    expect(engine.has('greet')).toBe(true);
    expect(engine.has('other')).toBe(false);
  });

  it('renderRaw renders without registration', () => {
    const engine = new TemplateEngine();
    expect(engine.renderRaw('Dear {{name}},', { name: 'Bob' })).toBe('Dear Bob,');
  });

  it('clear removes all templates', () => {
    const engine = new TemplateEngine();
    engine.register('t', 'body');
    engine.clear();
    expect(engine.has('t')).toBe(false);
  });

  it('renders template with no data when no placeholders', () => {
    const engine = new TemplateEngine();
    engine.register('plain', 'Plain text');
    expect(engine.render('plain', {})).toBe('Plain text');
  });
});

// ---------------------------------------------------------------------------
// UserPreferencesStore
// ---------------------------------------------------------------------------

describe('UserPreferencesStore', () => {
  it('isOptedOut returns false by default', () => {
    const store = new UserPreferencesStore();
    expect(store.isOptedOut('u1', 'email')).toBe(false);
  });

  it('optOut makes channel opted out', () => {
    const store = new UserPreferencesStore();
    store.optOut('u1', 'sms');
    expect(store.isOptedOut('u1', 'sms')).toBe(true);
  });

  it('optIn re-enables channel', () => {
    const store = new UserPreferencesStore();
    store.optOut('u1', 'push');
    store.optIn('u1', 'push');
    expect(store.isOptedOut('u1', 'push')).toBe(false);
  });

  it('getOptedOutChannels returns correct set', () => {
    const store = new UserPreferencesStore();
    store.optOutAll('u2', ['email', 'sms']);
    const channels = store.getOptedOutChannels('u2');
    expect(channels).toContain('email');
    expect(channels).toContain('sms');
    expect(channels).not.toContain('push');
  });

  it('clear resets all preferences', () => {
    const store = new UserPreferencesStore();
    store.optOut('u1', 'email');
    store.clear();
    expect(store.isOptedOut('u1', 'email')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RateLimiter
// ---------------------------------------------------------------------------

describe('RateLimiter', () => {
  it('allows requests under limit', () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxCount: 5 });
    expect(limiter.isAllowed('email', 'u1')).toBe(true);
  });

  it('blocks requests over limit', () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxCount: 2 });
    limiter.record('email', 'u1');
    limiter.record('email', 'u1');
    expect(limiter.isAllowed('email', 'u1')).toBe(false);
  });

  it('getCount returns current count', () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxCount: 10 });
    limiter.record('sms', 'u2');
    limiter.record('sms', 'u2');
    expect(limiter.getCount('sms', 'u2')).toBe(2);
  });

  it('reset clears all counts', () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxCount: 10 });
    limiter.record('email', 'u1');
    limiter.reset();
    expect(limiter.getCount('email', 'u1')).toBe(0);
  });

  it('different users are tracked independently', () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxCount: 1 });
    limiter.record('email', 'u1');
    expect(limiter.isAllowed('email', 'u2')).toBe(true);
    expect(limiter.isAllowed('email', 'u1')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// InMemoryNotificationAdapter
// ---------------------------------------------------------------------------

describe('InMemoryNotificationAdapter', () => {
  it('send returns sent status', async () => {
    const adapter = new InMemoryNotificationAdapter();
    const result = await adapter.send(makeNotification());
    expect(result.status).toBe('sent');
    expect(result.notificationId).toBe('n1');
  });

  it('getDeliveryRecord returns stored record', async () => {
    const adapter = new InMemoryNotificationAdapter();
    await adapter.send(makeNotification());
    const record = await adapter.getDeliveryRecord('n1');
    expect(record?.status).toBe('sent');
    expect(record?.sentAtMs).toBeTypeOf('number');
  });

  it('getDeliveryRecord returns undefined for unknown id', async () => {
    const adapter = new InMemoryNotificationAdapter();
    const record = await adapter.getDeliveryRecord('missing');
    expect(record).toBeUndefined();
  });

  it('sendBulk aggregates results', async () => {
    const adapter = new InMemoryNotificationAdapter();
    const bulk = await adapter.sendBulk([
      makeNotification({ id: 'a' }),
      makeNotification({ id: 'b' }),
    ]);
    expect(bulk.sent).toBe(2);
    expect(bulk.failed).toBe(0);
  });

  it('failChannels causes failed status', async () => {
    const adapter = new InMemoryNotificationAdapter(new Set(['email']));
    const result = await adapter.send(makeNotification());
    expect(result.status).toBe('failed');
    expect(result.failureReason).toBeDefined();
  });

  it('checkHealth always returns true', async () => {
    const adapter = new InMemoryNotificationAdapter();
    expect(await adapter.checkHealth()).toBe(true);
  });

  it('clear removes all records', async () => {
    const adapter = new InMemoryNotificationAdapter();
    await adapter.send(makeNotification());
    adapter.clear();
    expect(adapter.getAllRecords()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// WebhookNotificationAdapter
// ---------------------------------------------------------------------------

describe('WebhookNotificationAdapter', () => {
  it('sends notification via HTTP client', async () => {
    const client = { post: vi.fn().mockResolvedValue({ status: 200 }) };
    const adapter = new WebhookNotificationAdapter(client);
    const result = await adapter.send(makeWebhookNotification());
    expect(result.status).toBe('sent');
    expect(client.post).toHaveBeenCalledWith(
      'https://hooks.example.com',
      expect.objectContaining({ notificationId: 'wh1' }),
    );
  });

  it('returns failed when HTTP returns 500', async () => {
    const client = { post: vi.fn().mockResolvedValue({ status: 500 }) };
    const adapter = new WebhookNotificationAdapter(client);
    const result = await adapter.send(makeWebhookNotification());
    expect(result.status).toBe('failed');
    expect(result.failureReason).toContain('500');
  });

  it('returns failed when no webhookUrl', async () => {
    const client = { post: vi.fn().mockResolvedValue({ status: 200 }) };
    const adapter = new WebhookNotificationAdapter(client);
    const notification = makeNotification({
      id: 'x1',
      channel: 'webhook',
      recipient: { userId: 'u2' },
    });
    const result = await adapter.send(notification);
    expect(result.status).toBe('failed');
    expect(client.post).not.toHaveBeenCalled();
  });

  it('sendBulk aggregates results', async () => {
    const client = { post: vi.fn().mockResolvedValue({ status: 200 }) };
    const adapter = new WebhookNotificationAdapter(client);
    const bulk = await adapter.sendBulk([
      makeWebhookNotification({ id: 'w1' }),
      makeWebhookNotification({ id: 'w2' }),
    ]);
    expect(bulk.sent).toBe(2);
  });

  it('checkHealth returns true', async () => {
    const client = { post: vi.fn().mockResolvedValue({ status: 200 }) };
    const adapter = new WebhookNotificationAdapter(client);
    expect(await adapter.checkHealth()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RetryNotificationAdapter
// ---------------------------------------------------------------------------

describe('RetryNotificationAdapter', () => {
  it('returns result on first success', async () => {
    const inner = new InMemoryNotificationAdapter();
    const adapter = new RetryNotificationAdapter(inner);
    const result = await adapter.send(makeNotification());
    expect(result.status).toBe('sent');
  });

  it('retries and succeeds on second attempt', async () => {
    let callCount = 0;
    const inner: NotificationPort = {
      send: vi.fn().mockImplementation((n: Notification) => {
        callCount++;
        if (callCount < 2) return Promise.reject(new Error('transient'));
        return Promise.resolve({ notificationId: n.id, status: 'sent' } as const);
      }),
      sendBulk: vi.fn(),
      getDeliveryRecord: vi.fn().mockResolvedValue(undefined),
      checkHealth: vi.fn().mockResolvedValue(true),
    };
    const noDelay = vi.fn().mockResolvedValue(undefined);
    const adapter = new RetryNotificationAdapter(inner, {
      maxRetries: 3,
      baseBackoffMs: 10,
      delay: noDelay,
    });
    const result = await adapter.send(makeNotification());
    expect(result.status).toBe('sent');
    expect(callCount).toBe(2);
  });

  it('throws NotificationMaxRetriesExceededError after all retries', async () => {
    const inner: NotificationPort = {
      send: vi.fn().mockRejectedValue(new Error('always fails')),
      sendBulk: vi.fn(),
      getDeliveryRecord: vi.fn().mockResolvedValue(undefined),
      checkHealth: vi.fn().mockResolvedValue(true),
    };
    const noDelay = vi.fn().mockResolvedValue(undefined);
    const adapter = new RetryNotificationAdapter(inner, {
      maxRetries: 2,
      baseBackoffMs: 0,
      delay: noDelay,
    });
    await expect(adapter.send(makeNotification())).rejects.toBeInstanceOf(
      NotificationMaxRetriesExceededError,
    );
  });

  it('delegates getDeliveryRecord to inner', async () => {
    const inner = new InMemoryNotificationAdapter();
    const adapter = new RetryNotificationAdapter(inner);
    await inner.send(makeNotification());
    const record = await adapter.getDeliveryRecord('n1');
    expect(record?.status).toBe('sent');
  });

  it('delegates checkHealth to inner', async () => {
    const inner = new InMemoryNotificationAdapter();
    const adapter = new RetryNotificationAdapter(inner);
    expect(await adapter.checkHealth()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ManagedNotificationAdapter
// ---------------------------------------------------------------------------

describe('ManagedNotificationAdapter', () => {
  it('delivers notification normally when no rules triggered', async () => {
    const inner = new InMemoryNotificationAdapter();
    const prefs = new UserPreferencesStore();
    const adapter = new ManagedNotificationAdapter(inner, { preferences: prefs });
    const result = await adapter.send(makeNotification());
    expect(result.status).toBe('sent');
  });

  it('skips opted-out notification', async () => {
    const inner = new InMemoryNotificationAdapter();
    const prefs = new UserPreferencesStore();
    prefs.optOut('u1', 'email');
    const adapter = new ManagedNotificationAdapter(inner, { preferences: prefs });
    const result = await adapter.send(makeNotification());
    expect(result.status).toBe('skipped');
    expect(result.failureReason).toBe('opted out');
  });

  it('skips rate-limited notification', async () => {
    const inner = new InMemoryNotificationAdapter();
    const rateLimiter = new RateLimiter({ windowMs: 60_000, maxCount: 1 });
    rateLimiter.record('email', 'u1');
    const adapter = new ManagedNotificationAdapter(inner, { rateLimiter });
    const result = await adapter.send(makeNotification());
    expect(result.status).toBe('skipped');
    expect(result.failureReason).toBe('rate limited');
  });

  it('resolves template body before sending', async () => {
    const inner = new InMemoryNotificationAdapter();
    const templates = new TemplateEngine();
    templates.register('greet', 'Hello {{name}}!');
    const adapter = new ManagedNotificationAdapter(inner, { templates });
    const n = makeNotification({
      id: 't1',
      templateId: 'greet',
      templateData: { name: 'Carol' },
      body: 'fallback',
    });
    const result = await adapter.send(n);
    expect(result.status).toBe('sent');
    const record = await inner.getDeliveryRecord('t1');
    expect(record).toBeDefined();
  });

  it('sendBulk returns aggregated results', async () => {
    const inner = new InMemoryNotificationAdapter();
    const prefs = new UserPreferencesStore();
    prefs.optOut('u1', 'email');
    const adapter = new ManagedNotificationAdapter(inner, { preferences: prefs });
    const bulk = await adapter.sendBulk([
      makeNotification({ id: 'a' }),
      makeNotification({ id: 'b', recipient: { userId: 'u2' } }),
    ]);
    expect(bulk.skipped).toBe(1);
    expect(bulk.sent).toBe(1);
  });

  it('delegates checkHealth to inner', async () => {
    const inner = new InMemoryNotificationAdapter();
    const adapter = new ManagedNotificationAdapter(inner, {});
    expect(await adapter.checkHealth()).toBe(true);
  });

  it('records rate-limit timestamp so subsequent call is blocked', async () => {
    const inner = new InMemoryNotificationAdapter();
    const rateLimiter = new RateLimiter({ windowMs: 60_000, maxCount: 1 });
    const adapter = new ManagedNotificationAdapter(inner, { rateLimiter });
    const r1 = await adapter.send(makeNotification({ id: 'x1' }));
    const r2 = await adapter.send(makeNotification({ id: 'x2' }));
    expect(r1.status).toBe('sent');
    expect(r2.status).toBe('skipped');
  });
});

// ---------------------------------------------------------------------------
// Structural / exports
// ---------------------------------------------------------------------------

describe('Index exports', () => {
  it('exports error classes', () => {
    expect(NotificationDeliveryError).toBeDefined();
    expect(NotificationOptedOutError).toBeDefined();
    expect(NotificationRateLimitError).toBeDefined();
    expect(NotificationTemplateNotFoundError).toBeDefined();
    expect(NotificationMaxRetriesExceededError).toBeDefined();
  });

  it('exports adapter classes', () => {
    expect(InMemoryNotificationAdapter).toBeDefined();
    expect(WebhookNotificationAdapter).toBeDefined();
    expect(RetryNotificationAdapter).toBeDefined();
    expect(ManagedNotificationAdapter).toBeDefined();
  });
});
