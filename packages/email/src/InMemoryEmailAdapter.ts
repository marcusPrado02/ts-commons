import { randomUUID } from 'node:crypto';
import type { EmailPort } from './EmailPort';
import type { EmailMessage, SendEmailResult } from './EmailTypes';

/**
 * In-memory email adapter for testing.
 *
 * Stores all "sent" messages in memory. Use `getSentEmails()` / `getSentEmailsTo()`
 * to assert on outbound email behaviour in tests without an SMTP server.
 *
 * @example
 * ```ts
 * const mailer = new InMemoryEmailAdapter();
 * await mailer.send({ from: { email: 'no-reply@acme.dev' }, to: [{ email: 'user@example.com' }], subject: 'Hi' });
 * expect(mailer.getSentEmailsTo('user@example.com')).toHaveLength(1);
 * ```
 */
export class InMemoryEmailAdapter implements EmailPort {
  private readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<SendEmailResult> {
    this.sent.push(message);
    return Promise.resolve({
      messageId: randomUUID(),
      provider: 'in-memory',
      accepted: message.to.map((a) => a.email),
      rejected: [],
      timestamp: new Date(),
    });
  }

  async sendBatch(messages: readonly EmailMessage[]): Promise<readonly SendEmailResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async checkHealth(): Promise<boolean> {
    return Promise.resolve(true);
  }

  /** Return a snapshot of all emails sent via this adapter. */
  getSentEmails(): readonly EmailMessage[] {
    return [...this.sent];
  }

  /** Return emails whose `to` list contains the given address. */
  getSentEmailsTo(email: string): readonly EmailMessage[] {
    return this.sent.filter((m) => m.to.some((a) => a.email === email));
  }

  /** Reset internal state — useful in `beforeEach` hooks. */
  clear(): void {
    this.sent.length = 0;
  }
}
