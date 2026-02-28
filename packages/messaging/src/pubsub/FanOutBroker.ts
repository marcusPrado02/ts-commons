import type { EventEnvelope } from '../envelope/EventEnvelope';
import type { FanOutSubscriber } from './types';

type UnsubscribeFn = () => void;

/**
 * Fan-out pattern: distributes a single message to all registered subscribers.
 */
export class FanOutBroker<T = unknown> {
  private readonly subscribers = new Map<string, FanOutSubscriber<T>>();

  addSubscriber(
    id: string,
    handler: (envelope: EventEnvelope<T>) => void | Promise<void>,
  ): UnsubscribeFn {
    this.subscribers.set(id, { id, handler });
    return (): void => {
      this.subscribers.delete(id);
    };
  }

  removeSubscriber(id: string): void {
    this.subscribers.delete(id);
  }

  async publish(envelope: EventEnvelope<T>): Promise<void> {
    for (const sub of this.subscribers.values()) {
      const result = sub.handler(envelope);
      if (result instanceof Promise) await result;
    }
  }

  /**
   * Publish to a subset of subscribers by ID.
   */
  async publishTo(envelope: EventEnvelope<T>, ids: string[]): Promise<void> {
    const targets = ids
      .map((id) => this.subscribers.get(id))
      .filter((sub): sub is FanOutSubscriber<T> => sub != null);

    for (const sub of targets) {
      const result = sub.handler(envelope);
      if (result instanceof Promise) await result;
    }
  }

  subscriberCount(): number {
    return this.subscribers.size;
  }

  subscriberIds(): string[] {
    return Array.from(this.subscribers.keys());
  }

  clear(): void {
    this.subscribers.clear();
  }
}
