import { randomUUID } from 'node:crypto';
import type { LoggerPort } from '@acme/kernel';
import type { EmailPort } from './EmailPort';
import type { EmailAddress, EmailMessage, SendEmailResult } from './EmailTypes';

function formatAddress(a: EmailAddress): string {
  return a.name === undefined ? a.email : `${a.name} <${a.email}>`;
}

/**
 * Email adapter that logs outbound messages instead of delivering them.
 *
 * Use in development / staging to prevent accidental email delivery
 * while still exercising the full send pipeline.
 *
 * @example
 * ```ts
 * const mailer = new LoggingEmailAdapter(logger);
 * await mailer.send(message); // logs the message, returns a fake result
 * ```
 */
export class LoggingEmailAdapter implements EmailPort {
  constructor(private readonly logger: LoggerPort) {}

  send(message: EmailMessage): Promise<SendEmailResult> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this.logger.info('[LoggingEmailAdapter] Would send email', {
      from: formatAddress(message.from),
      to: message.to.map(formatAddress).join(', '),
      subject: message.subject,
      hasHtml: message.html !== undefined,
      hasText: message.text !== undefined,
      attachments: message.attachments?.length ?? 0,
    });

    return Promise.resolve({
      messageId: randomUUID(),
      provider: 'logging',
      accepted: message.to.map((a) => a.email),
      rejected: [],
      timestamp: new Date(),
    });
  }

  sendBatch(messages: readonly EmailMessage[]): Promise<readonly SendEmailResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }

  checkHealth(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
