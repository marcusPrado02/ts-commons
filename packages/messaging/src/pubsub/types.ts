import type { EventEnvelope } from '../envelope/EventEnvelope';

export type TopicPattern = string; // supports '*' wildcard and '#' multi-level wildcard

export interface TopicSubscription<T = unknown> {
  readonly pattern: TopicPattern;
  readonly handler: (envelope: EventEnvelope<T>) => void | Promise<void>;
}

export interface ContentFilter<T = unknown> {
  readonly field: string;
  readonly op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'in';
  readonly value: unknown;
  extract?: (envelope: EventEnvelope<T>) => unknown;
}

export interface ContentSubscription<T = unknown> {
  readonly filters: ContentFilter<T>[];
  readonly handler: (envelope: EventEnvelope<T>) => void | Promise<void>;
}

export interface FanOutSubscriber<T = unknown> {
  readonly id: string;
  readonly handler: (envelope: EventEnvelope<T>) => void | Promise<void>;
}

export interface RequestReplyOptions {
  readonly timeoutMs?: number;
}

export interface MessageFilterOptions<T = unknown> {
  readonly allowedTypes?: string[];
  readonly deniedTypes?: string[];
  readonly customFilter?: (envelope: EventEnvelope<T>) => boolean;
  readonly correlationId?: string;
}
