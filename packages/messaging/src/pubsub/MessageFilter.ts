import type { EventEnvelope } from '../envelope/EventEnvelope';
import type { MessageFilterOptions } from './types';

/**
 * Message filter: decides whether an envelope should be processed.
 */
export class MessageFilter<T = unknown> {
  constructor(private readonly options: MessageFilterOptions<T>) {}

  passes(envelope: EventEnvelope<T>): boolean {
    return (
      this.passesTypeChecks(envelope) &&
      this.passesCorrelationCheck(envelope) &&
      this.passesCustomFilter(envelope)
    );
  }

  private passesTypeChecks(envelope: EventEnvelope<T>): boolean {
    if (this.options.allowedTypes != null && this.options.allowedTypes.length > 0) {
      if (!this.options.allowedTypes.includes(envelope.eventType)) return false;
    }
    if (this.options.deniedTypes != null && this.options.deniedTypes.length > 0) {
      if (this.options.deniedTypes.includes(envelope.eventType)) return false;
    }
    return true;
  }

  private passesCorrelationCheck(envelope: EventEnvelope<T>): boolean {
    if (this.options.correlationId != null) {
      return envelope.correlationId === this.options.correlationId;
    }
    return true;
  }

  private passesCustomFilter(envelope: EventEnvelope<T>): boolean {
    if (this.options.customFilter != null) {
      return this.options.customFilter(envelope);
    }
    return true;
  }

  filter(envelopes: EventEnvelope<T>[]): EventEnvelope<T>[] {
    return envelopes.filter((e) => this.passes(e));
  }
}

/**
 * A filtering pub/sub router that only delivers messages passing the filter.
 */
export class FilteredRouter<T = unknown> {
  private readonly filter: MessageFilter<T>;
  private readonly subscribers = new Map<
    string,
    (envelope: EventEnvelope<T>) => void | Promise<void>
  >();
  private nextId = 1;

  constructor(options: MessageFilterOptions<T>) {
    this.filter = new MessageFilter(options);
  }

  subscribe(handler: (envelope: EventEnvelope<T>) => void | Promise<void>): () => void {
    const id = String(this.nextId++);
    this.subscribers.set(id, handler);
    return (): void => {
      this.subscribers.delete(id);
    };
  }

  async route(envelope: EventEnvelope<T>): Promise<void> {
    if (!this.filter.passes(envelope)) return;
    for (const h of this.subscribers.values()) {
      const result = h(envelope);
      if (result instanceof Promise) await result;
    }
  }

  subscriberCount(): number {
    return this.subscribers.size;
  }
}
