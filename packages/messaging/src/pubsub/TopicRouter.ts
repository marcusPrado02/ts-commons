import type { EventEnvelope } from '../envelope/EventEnvelope';
import type { TopicPattern, TopicSubscription } from './types';

type UnsubscribeFn = () => void;

/**
 * Routes messages to subscribers based on topic patterns.
 * Supports AMQP-style wildcards: '*' matches one segment, '#' matches multiple.
 */
export class TopicRouter<T = unknown> {
  private readonly subscriptions = new Map<string, TopicSubscription<T>>();
  private nextId = 1;

  subscribe(
    pattern: TopicPattern,
    handler: (envelope: EventEnvelope<T>) => void | Promise<void>,
  ): UnsubscribeFn {
    const id = String(this.nextId++);
    this.subscriptions.set(id, { pattern, handler });
    return (): void => {
      this.subscriptions.delete(id);
    };
  }

  async route(envelope: EventEnvelope<T>): Promise<void> {
    const topic = envelope.eventType;
    const matched: TopicSubscription<T>[] = [];

    for (const sub of this.subscriptions.values()) {
      if (this.matches(sub.pattern, topic)) {
        matched.push(sub);
      }
    }

    for (const sub of matched) {
      const result = sub.handler(envelope);
      if (result instanceof Promise) await result;
    }
  }

  private matches(pattern: string, topic: string): boolean {
    const patternParts = pattern.split('.');
    const topicParts = topic.split('.');
    return this.matchParts(patternParts, topicParts, 0, 0);
  }

  private matchParts(pattern: string[], topic: string[], pi: number, ti: number): boolean {
    if (pi === pattern.length && ti === topic.length) return true;
    if (pi === pattern.length) return false;

    const seg = pattern[pi];

    if (seg === '#') {
      // '#' matches zero or more remaining segments
      for (let j = ti; j <= topic.length; j++) {
        if (this.matchParts(pattern, topic, pi + 1, j)) return true;
      }
      return false;
    }

    if (ti === topic.length) return false;

    if (seg === '*') {
      return this.matchParts(pattern, topic, pi + 1, ti + 1);
    }

    if (seg !== topic[ti]) return false;
    return this.matchParts(pattern, topic, pi + 1, ti + 1);
  }

  subscriberCount(): number {
    return this.subscriptions.size;
  }

  clear(): void {
    this.subscriptions.clear();
  }
}
