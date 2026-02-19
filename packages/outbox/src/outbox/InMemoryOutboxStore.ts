import type { OutboxMessage, OutboxStorePort } from './OutboxStorePort';

/**
 * In-memory implementation of {@link OutboxStorePort}.
 * Intended for testing and single-process environments.
 */
export class InMemoryOutboxStore implements OutboxStorePort {
  private readonly messages = new Map<string, OutboxMessage>();

  save(message: OutboxMessage): Promise<void> {
    this.messages.set(message.id, message);
    return Promise.resolve();
  }

  getUnpublished(limit: number): Promise<OutboxMessage[]> {
    const result: OutboxMessage[] = [];

    for (const msg of this.messages.values()) {
      if (msg.publishedAt === undefined) {
        result.push(msg);
        if (result.length >= limit) break;
      }
    }

    return Promise.resolve(result);
  }

  markAsPublished(id: string): Promise<void> {
    const msg = this.messages.get(id);
    if (msg !== undefined) {
      // Destructure out `error` so it's absent (exactOptionalPropertyTypes disallows error: undefined)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { error: _ignored, ...base } = msg;
      const updated: OutboxMessage = {
        ...base,
        publishedAt: new Date(),
        attempts: msg.attempts + 1,
        lastAttemptAt: new Date(),
      };
      this.messages.set(id, updated);
    }
    return Promise.resolve();
  }

  markAsFailed(id: string, error: string): Promise<void> {
    const msg = this.messages.get(id);
    if (msg !== undefined) {
      this.messages.set(id, {
        ...msg,
        attempts: msg.attempts + 1,
        lastAttemptAt: new Date(),
        error,
      });
    }
    return Promise.resolve();
  }

  /** Returns all messages (for inspection in tests). */
  getAll(): OutboxMessage[] {
    return Array.from(this.messages.values());
  }

  /** Returns the number of stored messages. */
  size(): number {
    return this.messages.size;
  }
}
