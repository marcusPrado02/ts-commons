/**
 * Pub/Sub adapter backed by Redis.
 *
 * Uses two separate Redis connections:
 * - A **publisher** (standard `RedisClientLike`) for PUBLISH commands.
 * - A **subscriber** (`RedisPubSubClientLike`) dedicated to SUBSCRIBE mode —
 *   a connection in subscriber mode can only issue subscribe-family commands.
 *
 * All channel handler dispatch is done in-process; the subscriber connection
 * routes incoming messages via the `on('message')` event.
 */
import type { RedisClientLike, RedisPubSubClientLike } from './RedisClientLike';

/**
 * In-process message handler type.
 * Receives the raw string message as published by the sender.
 */
export type MessageHandler = (message: string) => void;

/**
 * Redis Pub/Sub coordinator.
 *
 * @example
 * ```typescript
 * const publisher  = new Redis() as unknown as RedisClientLike;
 * const subscriber = new Redis() as unknown as RedisPubSubClientLike;
 * const pubSub = new RedisPubSub(publisher, subscriber);
 *
 * // Subscribe to a channel
 * await pubSub.subscribe('user-events', (msg) => {
 *   const event = JSON.parse(msg) as UserEvent;
 *   console.log('received', event);
 * });
 *
 * // Publish
 * await pubSub.publish('user-events', JSON.stringify({ type: 'UserCreated', id: '1' }));
 *
 * // Unsubscribe a specific handler
 * await pubSub.unsubscribe('user-events', handler);
 * ```
 */
export class RedisPubSub {
  /** Map<channel, Set<handler>> for in-process dispatch. */
  private readonly handlers = new Map<string, Set<MessageHandler>>();

  constructor(
    private readonly publisher: RedisClientLike,
    private readonly subscriber: RedisPubSubClientLike,
  ) {
    // Wire once — all messages for subscribed channels funnel through here.
    this.subscriber.on('message', (channel: string, message: string) => {
      this.dispatch(channel, message);
    });
  }

  /**
   * Subscribe `handler` to `channel`.
   * Issues a Redis SUBSCRIBE command only on the first handler for a channel.
   */
  async subscribe(channel: string, handler: MessageHandler): Promise<void> {
    const existing = this.handlers.get(channel);
    if (existing === undefined) {
      this.handlers.set(channel, new Set([handler]));
      await this.subscriber.subscribe(channel);
    } else {
      existing.add(handler);
    }
  }

  /**
   * Remove `handler` from `channel`.
   * Issues a Redis UNSUBSCRIBE command when the last handler for the channel
   * is removed.  If `handler` is omitted, all handlers for the channel are removed.
   */
  async unsubscribe(channel: string, handler?: MessageHandler): Promise<void> {
    const existing = this.handlers.get(channel);
    if (existing === undefined) return;

    if (handler !== undefined) {
      existing.delete(handler);
    } else {
      existing.clear();
    }

    if (existing.size === 0) {
      this.handlers.delete(channel);
      await this.subscriber.unsubscribe(channel);
    }
  }

  /**
   * Publish a raw string message to `channel`.
   * Returns the number of subscribers that received the message.
   */
  async publish(channel: string, message: string): Promise<number> {
    return this.publisher.publish(channel, message);
  }

  /** Return the number of currently registered in-process handlers for a channel. */
  handlerCount(channel: string): number {
    return this.handlers.get(channel)?.size ?? 0;
  }

  /** Dispatch an incoming Redis message to all in-process handlers. */
  private dispatch(channel: string, message: string): void {
    const channelHandlers = this.handlers.get(channel);
    if (channelHandlers === undefined) return;
    channelHandlers.forEach((h) => { h(message); });
  }
}
