import { EmailSendError } from './EmailErrors';
import type { EmailPort } from './EmailPort';
import type { EmailAddress, EmailAttachment, EmailMessage, SendEmailResult } from './EmailTypes';

// ---------------------------------------------------------------------------
// Client-like interface (mirrors @sendgrid/mail shape)
// ---------------------------------------------------------------------------

export interface SendGridEmailAddress {
  readonly email: string;
  readonly name?: string;
}

export interface SendGridContent {
  readonly type: 'text/plain' | 'text/html';
  readonly value: string;
}

export interface SendGridAttachment {
  /** Base-64 encoded content. */
  readonly content: string;
  readonly filename: string;
  readonly type?: string;
  readonly contentId?: string;
  readonly disposition?: 'attachment' | 'inline';
}

export interface SendGridMessage {
  readonly from: SendGridEmailAddress;
  readonly to: readonly SendGridEmailAddress[];
  readonly cc?: readonly SendGridEmailAddress[];
  readonly bcc?: readonly SendGridEmailAddress[];
  readonly replyTo?: SendGridEmailAddress;
  readonly subject: string;
  readonly content?: readonly SendGridContent[];
  readonly attachments?: readonly SendGridAttachment[];
  readonly categories?: readonly string[];
  readonly headers?: Record<string, string>;
}

export interface SendGridResponse {
  readonly statusCode: number;
  readonly headers?: Record<string, string>;
}

/** Minimal interface for the `@sendgrid/mail` client. */
export interface SendGridClientLike {
  send(msg: SendGridMessage): Promise<[SendGridResponse]>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSgAddress(a: EmailAddress): SendGridEmailAddress {
  return a.name !== undefined ? { email: a.email, name: a.name } : { email: a.email };
}

function toSgAttachment(a: EmailAttachment): SendGridAttachment {
  const content =
    typeof a.content === 'string' ? a.content : Buffer.from(a.content).toString('base64');
  return {
    content,
    filename: a.filename,
    type: a.contentType,
    ...(a.contentId !== undefined && { contentId: a.contentId }),
    ...(a.disposition !== undefined && { disposition: a.disposition }),
  };
}

function buildSgContent(message: EmailMessage): SendGridContent[] {
  const content: SendGridContent[] = [];
  if (message.text !== undefined) content.push({ type: 'text/plain', value: message.text });
  if (message.html !== undefined) content.push({ type: 'text/html', value: message.html });
  return content;
}

function buildSgRecipients(message: EmailMessage): {
  cc?: readonly SendGridEmailAddress[];
  bcc?: readonly SendGridEmailAddress[];
  replyTo?: SendGridEmailAddress;
} {
  return {
    ...(message.cc !== undefined && message.cc.length > 0 && { cc: message.cc.map(toSgAddress) }),
    ...(message.bcc !== undefined &&
      message.bcc.length > 0 && { bcc: message.bcc.map(toSgAddress) }),
    ...(message.replyTo !== undefined && { replyTo: toSgAddress(message.replyTo) }),
  };
}

function buildSgExtras(
  message: EmailMessage,
  content: SendGridContent[],
): {
  content?: readonly SendGridContent[];
  attachments?: readonly SendGridAttachment[];
  categories?: readonly string[];
  headers?: Record<string, string>;
} {
  return {
    ...(content.length > 0 && { content }),
    ...(message.attachments !== undefined &&
      message.attachments.length > 0 && {
        attachments: message.attachments.map(toSgAttachment),
      }),
    ...(message.tags !== undefined && message.tags.length > 0 && { categories: [...message.tags] }),
    ...(message.headers !== undefined && { headers: { ...message.headers } }),
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Email adapter backed by the SendGrid API.
 *
 * Inject a client implementing {@link SendGridClientLike} (e.g. `@sendgrid/mail`).
 *
 * @example
 * ```ts
 * import sgMail from '@sendgrid/mail';
 * sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
 * const mailer = new SendGridEmailAdapter(sgMail);
 * ```
 */
export class SendGridEmailAdapter implements EmailPort {
  constructor(private readonly client: SendGridClientLike) {}

  async send(message: EmailMessage): Promise<SendEmailResult> {
    const content = buildSgContent(message);
    const msg: SendGridMessage = {
      from: toSgAddress(message.from),
      to: message.to.map(toSgAddress),
      subject: message.subject,
      ...buildSgRecipients(message),
      ...buildSgExtras(message, content),
    };

    try {
      const [response] = await this.client.send(msg);
      const accepted = message.to.map((a) => a.email);
      return {
        messageId: `sg-${Date.now().toString(16)}`,
        provider: 'sendgrid',
        accepted,
        rejected: response.statusCode >= 400 ? accepted : [],
        timestamp: new Date(),
      };
    } catch (err) {
      throw new EmailSendError('sendgrid', err instanceof Error ? err.message : String(err));
    }
  }

  async sendBatch(messages: readonly EmailMessage[]): Promise<readonly SendEmailResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async checkHealth(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
