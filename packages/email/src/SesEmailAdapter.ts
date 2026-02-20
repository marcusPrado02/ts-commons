import { EmailSendError } from './EmailErrors';
import type { EmailPort } from './EmailPort';
import type { EmailAddress, EmailMessage, SendEmailResult } from './EmailTypes';

// ---------------------------------------------------------------------------
// Client-like interface (mirrors @aws-sdk/client-sesv2 shape)
// ---------------------------------------------------------------------------

export interface SesDestination {
  readonly ToAddresses?: readonly string[];
  readonly CcAddresses?: readonly string[];
  readonly BccAddresses?: readonly string[];
}

export interface SesContent {
  readonly Data: string;
  readonly Charset?: string;
}

export interface SesSendEmailParams {
  readonly FromEmailAddress: string;
  readonly Destination: SesDestination;
  readonly ReplyToAddresses?: readonly string[];
  readonly Content: {
    readonly Simple: {
      readonly Subject: SesContent;
      readonly Body: {
        readonly Text?: SesContent;
        readonly Html?: SesContent;
      };
    };
  };
}

export interface SesSendEmailResult {
  readonly MessageId?: string;
}

/** Minimal interface for the AWS SESv2 client (`@aws-sdk/client-sesv2`). */
export interface SesClientLike {
  sendEmail(params: SesSendEmailParams): Promise<SesSendEmailResult>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAddress(a: EmailAddress): string {
  return a.name !== undefined ? `"${a.name}" <${a.email}>` : a.email;
}

function buildSesDestination(message: EmailMessage): SesDestination {
  return {
    ToAddresses: message.to.map(formatAddress),
    ...(message.cc !== undefined &&
      message.cc.length > 0 && { CcAddresses: message.cc.map(formatAddress) }),
    ...(message.bcc !== undefined &&
      message.bcc.length > 0 && { BccAddresses: message.bcc.map(formatAddress) }),
  };
}

function buildSesBody(message: EmailMessage): {
  Text?: SesContent;
  Html?: SesContent;
} {
  return {
    ...(message.text !== undefined && { Text: { Data: message.text, Charset: 'UTF-8' } }),
    ...(message.html !== undefined && { Html: { Data: message.html, Charset: 'UTF-8' } }),
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Email adapter backed by Amazon SES v2.
 *
 * Inject an SES client implementing {@link SesClientLike}
 * (e.g. `new SESv2Client({})` from `@aws-sdk/client-sesv2`).
 *
 * @example
 * ```ts
 * import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
 * const ses = new SESv2Client({ region: 'us-east-1' });
 * const mailer = new SesEmailAdapter({ sendEmail: (p) => ses.send(new SendEmailCommand(p)) });
 * ```
 */
export class SesEmailAdapter implements EmailPort {
  constructor(private readonly client: SesClientLike) {}

  async send(message: EmailMessage): Promise<SendEmailResult> {
    const params: SesSendEmailParams = {
      FromEmailAddress: formatAddress(message.from),
      Destination: buildSesDestination(message),
      ...(message.replyTo !== undefined && { ReplyToAddresses: [formatAddress(message.replyTo)] }),
      Content: {
        Simple: {
          Subject: { Data: message.subject, Charset: 'UTF-8' },
          Body: buildSesBody(message),
        },
      },
    };

    try {
      const result = await this.client.sendEmail(params);
      return {
        messageId: result.MessageId ?? `ses-${Date.now().toString(16)}`,
        provider: 'ses',
        accepted: message.to.map((a) => a.email),
        rejected: [],
        timestamp: new Date(),
      };
    } catch (err) {
      throw new EmailSendError('ses', err instanceof Error ? err.message : String(err));
    }
  }

  async sendBatch(messages: readonly EmailMessage[]): Promise<readonly SendEmailResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async checkHealth(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
