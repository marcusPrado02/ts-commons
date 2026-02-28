import type { EventEnvelope } from '../envelope/EventEnvelope';
import type { ContentFilter, ContentSubscription } from './types';

type UnsubscribeFn = () => void;

/**
 * Routes messages based on content/payload field matchers.
 */
export class ContentRouter<T = unknown> {
  private readonly subscriptions = new Map<string, ContentSubscription<T>>();
  private nextId = 1;

  subscribe(
    filters: ContentFilter<T>[],
    handler: (envelope: EventEnvelope<T>) => void | Promise<void>,
  ): UnsubscribeFn {
    const id = String(this.nextId++);
    this.subscriptions.set(id, { filters, handler });
    return (): void => {
      this.subscriptions.delete(id);
    };
  }

  async route(envelope: EventEnvelope<T>): Promise<void> {
    for (const sub of this.subscriptions.values()) {
      if (this.evaluate(envelope, sub.filters)) {
        const result = sub.handler(envelope);
        if (result instanceof Promise) await result;
      }
    }
  }

  private evaluate(envelope: EventEnvelope<T>, filters: ContentFilter<T>[]): boolean {
    return filters.every((f) => this.evaluateOne(envelope, f));
  }

  private evaluateOne(envelope: EventEnvelope<T>, filter: ContentFilter<T>): boolean {
    const value =
      filter.extract != null ? filter.extract(envelope) : this.getField(envelope, filter.field);

    return this.compareValues(value, filter.op, filter.value);
  }

  private compareValues(value: unknown, op: ContentFilter<T>['op'], expected: unknown): boolean {
    if (op === 'eq') return value === expected;
    if (op === 'neq') return value !== expected;
    if (op === 'in') return Array.isArray(expected) && expected.includes(value);
    if (op === 'contains' || op === 'startsWith') return this.compareString(value, op, expected);
    return this.compareNumeric(value, op, expected);
  }

  private compareString(value: unknown, op: 'contains' | 'startsWith', expected: unknown): boolean {
    if (typeof value !== 'string' || typeof expected !== 'string') return false;
    return op === 'contains' ? value.includes(expected) : value.startsWith(expected);
  }

  private compareNumeric(
    value: unknown,
    op: 'gt' | 'gte' | 'lt' | 'lte',
    expected: unknown,
  ): boolean {
    if (typeof value !== 'number' || typeof expected !== 'number') return false;
    if (op === 'gt') return value > expected;
    if (op === 'gte') return value >= expected;
    if (op === 'lt') return value < expected;
    return value <= expected;
  }

  private getField(envelope: EventEnvelope<T>, field: string): unknown {
    const payload = envelope.payload as Record<string, unknown>;
    const env = envelope as unknown as Record<string, unknown>;
    if (typeof payload === 'object' && field in payload) {
      return payload[field];
    }
    return env[field];
  }

  subscriberCount(): number {
    return this.subscriptions.size;
  }

  clear(): void {
    this.subscriptions.clear();
  }
}
