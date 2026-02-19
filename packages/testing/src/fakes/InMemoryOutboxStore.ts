import type { OutboxMessage, OutboxStorePort } from '@acme/outbox';

export class InMemoryOutboxStore implements OutboxStorePort {
  private readonly messages = new Map<string, OutboxMessage>();

  save(message: OutboxMessage): Promise<void> {
    this.messages.set(message.id, message);
    return Promise.resolve();
  }

  getUnpublished(limit: number): Promise<OutboxMessage[]> {
    return Promise.resolve(
      Array.from(this.messages.values())
        .filter((m) => m.publishedAt === undefined)
        .slice(0, limit),
    );
  }

  markAsPublished(id: string): Promise<void> {
    const message = this.messages.get(id);
    if (message !== undefined) {
      // Destructure out `error` to avoid exactOptionalPropertyTypes violation
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { error: _e, ...base } = message;
      this.messages.set(id, { ...base, publishedAt: new Date(), attempts: message.attempts + 1 });
    }
    return Promise.resolve();
  }

  markAsFailed(id: string, error: string): Promise<void> {
    const message = this.messages.get(id);
    if (message !== undefined) {
      this.messages.set(id, {
        ...message,
        attempts: message.attempts + 1,
        lastAttemptAt: new Date(),
        error,
      });
    }
    return Promise.resolve();
  }

  clear(): void {
    this.messages.clear();
  }
}
