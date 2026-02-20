/**
 * Tests for @acme/email
 *
 * Covers:
 *   - InMemoryEmailAdapter (7 tests)
 *   - LoggingEmailAdapter   (3 tests)
 *   - InMemoryTemplateEngine (5 tests)
 *   - InMemoryEmailTracker  (5 tests)
 *   - SmtpEmailAdapter      (4 tests)
 *   - SendGridEmailAdapter  (3 tests)
 *   - MailgunEmailAdapter   (3 tests)
 *   - SesEmailAdapter       (3 tests)
 *   - Error classes         (3 tests)
 *   Total: 36 tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryEmailAdapter } from './InMemoryEmailAdapter';
import { LoggingEmailAdapter } from './LoggingEmailAdapter';
import { InMemoryTemplateEngine } from './EmailTemplateEngine';
import { InMemoryEmailTracker } from './EmailTracker';
import { SmtpEmailAdapter } from './SmtpEmailAdapter';
import { SendGridEmailAdapter } from './SendGridEmailAdapter';
import { MailgunEmailAdapter } from './MailgunEmailAdapter';
import { SesEmailAdapter } from './SesEmailAdapter';
import {
  EmailAttachmentError,
  EmailProviderError,
  EmailSendError,
  EmailValidationError,
} from './EmailErrors';
import type { EmailMessage } from './EmailTypes';
import type { SmtpClientLike, SmtpSendMailResult } from './SmtpEmailAdapter';
import type { SendGridClientLike, SendGridResponse } from './SendGridEmailAdapter';
import type { MailgunClientLike } from './MailgunEmailAdapter';
import type { SesClientLike } from './SesEmailAdapter';
import type { LoggerPort } from '@acme/kernel';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function buildMessage(overrides?: Partial<EmailMessage>): EmailMessage {
  return {
    from: { email: 'sender@acme.dev', name: 'ACME' },
    to: [{ email: 'user@example.com', name: 'Alice' }],
    subject: 'Hello, {{name}}!',
    text: 'Plain text body.',
    html: '<p>HTML body</p>',
    ...overrides,
  };
}

function buildMockLogger(): LoggerPort {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function buildSmtpClient(overrides?: Partial<SmtpClientLike>): SmtpClientLike {
  const result: SmtpSendMailResult = {
    messageId: 'smtp-msg-001',
    accepted: ['user@example.com'],
    rejected: [],
  };
  return {
    sendMail: vi.fn().mockResolvedValue(result),
    verify: vi.fn().mockResolvedValue(true),
    close: vi.fn(),
    ...overrides,
  };
}

function buildSgClient(statusCode = 202): SendGridClientLike {
  const response: SendGridResponse = { statusCode };
  return {
    send: vi.fn().mockResolvedValue([response]),
  };
}

function buildMgClient(): MailgunClientLike {
  return {
    create: vi
      .fn()
      .mockResolvedValue({ id: '<mg-msg-001@sandbox.mailgun.org>', message: 'Queued.' }),
  };
}

function buildSesClient(): SesClientLike {
  return {
    sendEmail: vi.fn().mockResolvedValue({ MessageId: 'ses-msg-001' }),
  };
}

// ---------------------------------------------------------------------------
// InMemoryEmailAdapter
// ---------------------------------------------------------------------------

describe('InMemoryEmailAdapter', () => {
  let adapter: InMemoryEmailAdapter;

  beforeEach(() => {
    adapter = new InMemoryEmailAdapter();
  });

  it('send() should store the message and return a result', async () => {
    const message = buildMessage();

    const result = await adapter.send(message);

    expect(result.provider).toBe('in-memory');
    expect(result.accepted).toContain('user@example.com');
    expect(result.rejected).toHaveLength(0);
    expect(result.messageId).toBeTruthy();
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it('send() messageId should be a valid UUID', async () => {
    const result = await adapter.send(buildMessage());

    expect(result.messageId).toMatch(
      /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i,
    );
  });

  it('getSentEmails() should return all sent messages', async () => {
    await adapter.send(buildMessage());
    await adapter.send(buildMessage({ to: [{ email: 'other@example.com' }] }));

    expect(adapter.getSentEmails()).toHaveLength(2);
  });

  it('getSentEmailsTo() should filter by recipient address', async () => {
    await adapter.send(buildMessage());
    await adapter.send(buildMessage({ to: [{ email: 'other@example.com' }] }));

    const results = adapter.getSentEmailsTo('user@example.com');

    expect(results).toHaveLength(1);
    expect(results[0]?.to[0]?.email).toBe('user@example.com');
  });

  it('clear() should reset the sent messages list', async () => {
    await adapter.send(buildMessage());
    adapter.clear();

    expect(adapter.getSentEmails()).toHaveLength(0);
  });

  it('sendBatch() should send all messages and return results', async () => {
    const messages = [buildMessage(), buildMessage({ subject: 'Second' })];

    const results = await adapter.sendBatch(messages);

    expect(results).toHaveLength(2);
    expect(adapter.getSentEmails()).toHaveLength(2);
  });

  it('checkHealth() should return true', async () => {
    expect(await adapter.checkHealth()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// LoggingEmailAdapter
// ---------------------------------------------------------------------------

describe('LoggingEmailAdapter', () => {
  it('send() should log the message and return a result', async () => {
    const logger = buildMockLogger();
    const adapter = new LoggingEmailAdapter(logger);

    const result = await adapter.send(buildMessage());

    expect(logger.info).toHaveBeenCalledOnce();
    expect(result.provider).toBe('logging');
    expect(result.accepted).toContain('user@example.com');
  });

  it('sendBatch() should log each message', async () => {
    const logger = buildMockLogger();
    const adapter = new LoggingEmailAdapter(logger);

    await adapter.sendBatch([buildMessage(), buildMessage({ subject: 'Second' })]);

    expect(logger.info).toHaveBeenCalledTimes(2);
  });

  it('checkHealth() should return true', async () => {
    const adapter = new LoggingEmailAdapter(buildMockLogger());

    expect(await adapter.checkHealth()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// InMemoryTemplateEngine
// ---------------------------------------------------------------------------

describe('InMemoryTemplateEngine', () => {
  it('render() should interpolate variables into subject, html and text', async () => {
    const engine = new InMemoryTemplateEngine();
    engine.register('welcome', {
      subject: 'Welcome, {{name}}!',
      html: '<p>Hi {{name}}, you have {{points}} points.</p>',
      text: 'Hi {{name}}, you have {{points}} points.',
    });

    const rendered = await engine.render('welcome', { name: 'Alice', points: 42 });

    expect(rendered.subject).toBe('Welcome, Alice!');
    expect(rendered.html).toBe('<p>Hi Alice, you have 42 points.</p>');
    expect(rendered.text).toBe('Hi Alice, you have 42 points.');
  });

  it('render() should leave unknown placeholders unchanged', async () => {
    const engine = new InMemoryTemplateEngine();
    engine.register('t', { subject: 'Hello {{unknown}}' });

    const rendered = await engine.render('t', {});

    expect(rendered.subject).toBe('Hello {{unknown}}');
  });

  it('render() should throw EmailValidationError for unregistered templates', async () => {
    const engine = new InMemoryTemplateEngine();

    await expect(engine.render('missing', {})).rejects.toThrow(EmailValidationError);
  });

  it('register() should replace an existing template', async () => {
    const engine = new InMemoryTemplateEngine();
    engine.register('t', { subject: 'Old' });
    engine.register('t', { subject: 'New' });

    const rendered = await engine.render('t', {});

    expect(rendered.subject).toBe('New');
  });

  it('render() should handle templates with no html/text gracefully', async () => {
    const engine = new InMemoryTemplateEngine();
    engine.register('t', { subject: 'Subject only' });

    const rendered = await engine.render('t', {});

    expect(rendered.subject).toBe('Subject only');
    expect(rendered.html).toBeUndefined();
    expect(rendered.text).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// InMemoryEmailTracker
// ---------------------------------------------------------------------------

describe('InMemoryEmailTracker', () => {
  it('record() and getEvents() should store and filter by messageId', () => {
    const tracker = new InMemoryEmailTracker();
    tracker.record({ messageId: 'msg-1', event: 'sent', timestamp: new Date() });
    tracker.record({ messageId: 'msg-2', event: 'delivered', timestamp: new Date() });

    expect(tracker.getEvents('msg-1')).toHaveLength(1);
    expect(tracker.getEvents('msg-1')[0]?.event).toBe('sent');
  });

  it('getStats() should count events by type', () => {
    const tracker = new InMemoryEmailTracker();
    tracker.record({ messageId: 'a', event: 'sent', timestamp: new Date() });
    tracker.record({ messageId: 'a', event: 'delivered', timestamp: new Date() });
    tracker.record({ messageId: 'a', event: 'opened', timestamp: new Date() });
    tracker.record({ messageId: 'b', event: 'bounced', timestamp: new Date() });

    const stats = tracker.getStats();

    expect(stats.sent).toBe(1);
    expect(stats.delivered).toBe(1);
    expect(stats.opened).toBe(1);
    expect(stats.bounced).toBe(1);
    expect(stats.clicked).toBe(0);
  });

  it('clear() should remove all recorded events', () => {
    const tracker = new InMemoryEmailTracker();
    tracker.record({ messageId: 'a', event: 'sent', timestamp: new Date() });
    tracker.clear();

    expect(tracker.getAllEvents()).toHaveLength(0);
    expect(tracker.getStats().sent).toBe(0);
  });

  it('getAllEvents() should return a copy of all events', () => {
    const tracker = new InMemoryEmailTracker();
    tracker.record({ messageId: 'a', event: 'sent', timestamp: new Date() });
    tracker.record({ messageId: 'b', event: 'clicked', timestamp: new Date() });

    expect(tracker.getAllEvents()).toHaveLength(2);
  });

  it('record() should support metadata on events', () => {
    const tracker = new InMemoryEmailTracker();
    tracker.record({
      messageId: 'x',
      event: 'opened',
      timestamp: new Date(),
      metadata: { ip: '1.2.3.4' },
    });

    const events = tracker.getEvents('x');
    expect(events[0]?.metadata?.['ip']).toBe('1.2.3.4');
  });
});

// ---------------------------------------------------------------------------
// SmtpEmailAdapter
// ---------------------------------------------------------------------------

describe('SmtpEmailAdapter', () => {
  it('send() should call the SMTP client with formatted addresses', async () => {
    const client = buildSmtpClient();
    const adapter = new SmtpEmailAdapter(client);

    const result = await adapter.send(buildMessage());

    expect(client.sendMail).toHaveBeenCalledOnce();
    expect(result.provider).toBe('smtp');
    expect(result.messageId).toBe('smtp-msg-001');
  });

  it('send() should wrap transport errors in EmailSendError', async () => {
    const client = buildSmtpClient({
      sendMail: vi.fn().mockRejectedValue(new Error('Connection refused')),
    });
    const adapter = new SmtpEmailAdapter(client);

    await expect(adapter.send(buildMessage())).rejects.toThrow(EmailSendError);
    await expect(adapter.send(buildMessage())).rejects.toThrow('Connection refused');
  });

  it('checkHealth() should delegate to client.verify()', async () => {
    const client = buildSmtpClient();
    const adapter = new SmtpEmailAdapter(client);

    expect(await adapter.checkHealth()).toBe(true);
    expect(client.verify).toHaveBeenCalledOnce();
  });

  it('checkHealth() should return false when verify() throws', async () => {
    const client = buildSmtpClient({
      verify: vi.fn().mockRejectedValue(new Error('Auth failed')),
    });
    const adapter = new SmtpEmailAdapter(client);

    expect(await adapter.checkHealth()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SendGridEmailAdapter
// ---------------------------------------------------------------------------

describe('SendGridEmailAdapter', () => {
  it('send() should call the SendGrid client and return a result', async () => {
    const client = buildSgClient();
    const adapter = new SendGridEmailAdapter(client);

    const result = await adapter.send(buildMessage());

    expect(client.send).toHaveBeenCalledOnce();
    expect(result.provider).toBe('sendgrid');
    expect(result.accepted).toContain('user@example.com');
  });

  it('send() should wrap API errors in EmailSendError', async () => {
    const client: SendGridClientLike = {
      send: vi.fn().mockRejectedValue(new Error('Unauthorized')),
    };
    const adapter = new SendGridEmailAdapter(client);

    await expect(adapter.send(buildMessage())).rejects.toThrow(EmailSendError);
  });

  it('sendBatch() should send all messages', async () => {
    const client = buildSgClient();
    const adapter = new SendGridEmailAdapter(client);

    const results = await adapter.sendBatch([buildMessage(), buildMessage({ subject: 'Second' })]);

    expect(results).toHaveLength(2);
    expect(client.send).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// MailgunEmailAdapter
// ---------------------------------------------------------------------------

describe('MailgunEmailAdapter', () => {
  it('send() should call the Mailgun client and return a result', async () => {
    const client = buildMgClient();
    const adapter = new MailgunEmailAdapter(client, 'sandbox.mailgun.org');

    const result = await adapter.send(buildMessage());

    expect(client.create).toHaveBeenCalledOnce();
    expect(result.provider).toBe('mailgun');
    expect(result.messageId).toBe('<mg-msg-001@sandbox.mailgun.org>');
  });

  it('send() should wrap errors in EmailSendError', async () => {
    const client: MailgunClientLike = {
      create: vi.fn().mockRejectedValue(new Error('Domain not found')),
    };
    const adapter = new MailgunEmailAdapter(client, 'bad.domain');

    await expect(adapter.send(buildMessage())).rejects.toThrow(EmailSendError);
  });

  it('sendBatch() should send all messages', async () => {
    const client = buildMgClient();
    const adapter = new MailgunEmailAdapter(client, 'sandbox.mailgun.org');

    const results = await adapter.sendBatch([buildMessage(), buildMessage({ subject: 'Second' })]);

    expect(results).toHaveLength(2);
    expect(client.create).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// SesEmailAdapter
// ---------------------------------------------------------------------------

describe('SesEmailAdapter', () => {
  it('send() should call the SES client and return a result', async () => {
    const client = buildSesClient();
    const adapter = new SesEmailAdapter(client);

    const result = await adapter.send(buildMessage());

    expect(client.sendEmail).toHaveBeenCalledOnce();
    expect(result.provider).toBe('ses');
    expect(result.messageId).toBe('ses-msg-001');
  });

  it('send() should wrap SES errors in EmailSendError', async () => {
    const client: SesClientLike = {
      sendEmail: vi.fn().mockRejectedValue(new Error('MessageRejected')),
    };
    const adapter = new SesEmailAdapter(client);

    await expect(adapter.send(buildMessage())).rejects.toThrow(EmailSendError);
  });

  it('sendBatch() should send all messages', async () => {
    const client = buildSesClient();
    const adapter = new SesEmailAdapter(client);

    const results = await adapter.sendBatch([buildMessage(), buildMessage({ subject: 'Second' })]);

    expect(results).toHaveLength(2);
    expect(client.sendEmail).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

describe('Email error classes', () => {
  it('EmailValidationError should expose field and name', () => {
    const err = new EmailValidationError('to', 'must not be empty');

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('EmailValidationError');
    expect(err.field).toBe('to');
    expect(err.message).toContain('must not be empty');
  });

  it('EmailSendError should expose provider and optional statusCode', () => {
    const err = new EmailSendError('smtp', 'timeout', 503);

    expect(err.name).toBe('EmailSendError');
    expect(err.provider).toBe('smtp');
    expect(err.statusCode).toBe(503);
  });

  it('EmailProviderError and EmailAttachmentError should set name correctly', () => {
    const pe = new EmailProviderError('ses', 'region unavailable');
    const ae = new EmailAttachmentError('invoice.pdf', 'file too large');

    expect(pe.name).toBe('EmailProviderError');
    expect(pe.provider).toBe('ses');
    expect(ae.name).toBe('EmailAttachmentError');
    expect(ae.filename).toBe('invoice.pdf');
  });
});
