import type { OutboxMessage, OutboxStorePort } from '@acme/outbox';

export class InMemoryOutboxStore implements OutboxStorePort {
  private readonly messages = new Map<string, OutboxMessage>();

  async save(message: OutboxMessage): Promise<void> {
    this.messages.set(message.id, message);
    return Promise.resolve();
  }

  async getUnpublished(limit: number): Promise<OutboxMessage[]> {
    return Promise.resolve(
      Array.from(this.messages.values())
        .filter((m) => !m.publishedAt)
        .slice(0, limit),
    );
  }

  async markAsPublished(id: string): Promise<void> {
    const message = this.messages.get(id);
    if (message) {
      this.messages.set(id, { ...message, publishedAt: new Date() });
    }
    return Promise.resolve();
  }

  async markAsFailed(id: string, error: string): Promise<void> {
    const message = this.messages.get(id);
    if (message) {
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
