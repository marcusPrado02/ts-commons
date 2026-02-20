import { EmailSendError } from './EmailErrors';
import type { EmailPort } from './EmailPort';
import type { EmailAddress, EmailMessage, SendEmailResult } from './EmailTypes';

// ---------------------------------------------------------------------------
// Client-like interface (mirrors mailgun.js shape)
// ---------------------------------------------------------------------------

export interface MailgunMessageData {
  readonly from: string;
  readonly to: string | readonly string[];
  readonly cc?: string;
  readonly bcc?: string;
  readonly subject: string;
  readonly text?: string;
  readonly html?: string;
  readonly 'h:Reply-To'?: string;
  readonly 'o:tag'?: readonly string[];
}

export interface MailgunResponse {
  readonly id: string;
  readonly message: string;
}

/** Minimal interface for mailgun.js messages client. */
export interface MailgunClientLike {
  create(domain: string, data: MailgunMessageData): Promise<MailgunResponse>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAddress(a: EmailAddress): string {
  return a.name !== undefined ? `${a.name} <${a.email}>` : a.email;
}

function buildMgAddressFields(message: EmailMessage): {
  cc?: string;
  bcc?: string;
  'h:Reply-To'?: string;
} {
  return {
    ...(message.cc !== undefined &&
      message.cc.length > 0 && { cc: message.cc.map(formatAddress).join(', ') }),
    ...(message.bcc !== undefined &&
      message.bcc.length > 0 && { bcc: message.bcc.map(formatAddress).join(', ') }),
    ...(message.replyTo !== undefined && { 'h:Reply-To': formatAddress(message.replyTo) }),
  };
}

function buildMgBodyFields(message: EmailMessage): {
  text?: string;
  html?: string;
  'o:tag'?: readonly string[];
} {
  return {
    ...(message.text !== undefined && { text: message.text }),
    ...(message.html !== undefined && { html: message.html }),
    ...(message.tags !== undefined && message.tags.length > 0 && { 'o:tag': message.tags }),
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Email adapter backed by the Mailgun API.
 *
 * Inject the Mailgun messages client implementing {@link MailgunClientLike}.
 *
 * @example
 * ```ts
 * import Mailgun from 'mailgun.js';
 * import FormData from 'form-data';
 * const mg = new Mailgun(FormData).client({ username: 'api', key: process.env.MAILGUN_API_KEY! });
 * const mailer = new MailgunEmailAdapter(mg.messages, 'mg.example.com');
 * ```
 */
export class MailgunEmailAdapter implements EmailPort {
  constructor(
    private readonly client: MailgunClientLike,
    private readonly domain: string,
  ) {}

  async send(message: EmailMessage): Promise<SendEmailResult> {
    const data: MailgunMessageData = {
      from: formatAddress(message.from),
      to: message.to.map(formatAddress),
      subject: message.subject,
      ...buildMgAddressFields(message),
      ...buildMgBodyFields(message),
    };

    try {
      const response = await this.client.create(this.domain, data);
      return {
        messageId: response.id,
        provider: 'mailgun',
        accepted: message.to.map((a) => a.email),
        rejected: [],
        timestamp: new Date(),
      };
    } catch (err) {
      throw new EmailSendError('mailgun', err instanceof Error ? err.message : String(err));
    }
  }

  async sendBatch(messages: readonly EmailMessage[]): Promise<readonly SendEmailResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async checkHealth(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
