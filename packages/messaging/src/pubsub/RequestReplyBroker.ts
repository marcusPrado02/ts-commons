import type { EventEnvelope } from '../envelope/EventEnvelope';
import type { RequestReplyOptions } from './types';

type ReplyHandler<R> = (reply: EventEnvelope<R>) => void;
type UnsubscribeFn = () => void;

/**
 * Request-reply pattern built on top of correlation IDs.
 * Sender registers a pending reply and waits; replier publishes back with matching correlationId.
 */
export class RequestReplyBroker<Q = unknown, R = unknown> {
  private readonly pending = new Map<
    string,
    { resolve: ReplyHandler<R>; timer: ReturnType<typeof setTimeout> }
  >();

  /**
   * Register a pending reply for the given correlationId.
   * Returns a Promise that resolves when the reply is received (or rejects on timeout).
   */
  awaitReply(correlationId: string, options?: RequestReplyOptions): Promise<EventEnvelope<R>> {
    const timeoutMs = options?.timeoutMs ?? 5000;
    return new Promise<EventEnvelope<R>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(correlationId);
        reject(
          new Error(`Reply for correlationId "${correlationId}" timed out after ${timeoutMs}ms`),
        );
      }, timeoutMs);

      this.pending.set(correlationId, {
        resolve: (reply: EventEnvelope<R>): void => {
          clearTimeout(timer);
          resolve(reply);
        },
        timer,
      });
    });
  }

  /**
   * Deliver a reply — finds the pending request by correlationId and resolves it.
   * Returns true if a pending request was matched.
   */
  deliver(reply: EventEnvelope<R>): boolean {
    const correlationId = reply.correlationId;
    if (correlationId == null) return false;

    const pending = this.pending.get(correlationId);
    if (pending == null) return false;

    this.pending.delete(correlationId);
    pending.resolve(reply);
    return true;
  }

  /**
   * Cancel a pending reply (e.g. on shutdown).
   */
  cancel(correlationId: string): void {
    const pending = this.pending.get(correlationId);
    if (pending != null) {
      clearTimeout(pending.timer);
      this.pending.delete(correlationId);
    }
  }

  pendingCount(): number {
    return this.pending.size;
  }

  /**
   * Subscribe to all incoming envelopes and automatically route replies.
   * Use this to hook into a message bus.
   */
  createReplyListener(): (envelope: EventEnvelope<R>) => void {
    return (envelope: EventEnvelope<R>): void => {
      this.deliver(envelope);
    };
  }

  /**
   * Create both a request sender and reply subscription in one call.
   * `send` should publish the request; `onReply` should be hooked to incoming messages.
   */
  createChannel(send: (request: EventEnvelope<Q>) => void | Promise<void>): {
    request: (
      envelope: EventEnvelope<Q>,
      options?: RequestReplyOptions,
    ) => Promise<EventEnvelope<R>>;
    onReply: UnsubscribeFn;
  } {
    const listener = this.createReplyListener();
    return {
      request: async (
        envelope: EventEnvelope<Q>,
        options?: RequestReplyOptions,
      ): Promise<EventEnvelope<R>> => {
        if (envelope.correlationId == null) {
          throw new Error('request envelope must have a correlationId');
        }
        const promise = this.awaitReply(envelope.correlationId, options);
        await send(envelope);
        return promise;
      },
      onReply: (): void => {
        // Hook this as the "unsubscribe" if the caller was managing subscriptions
        // In this minimal broker the listener is the same reference
        void listener;
      },
    };
  }

  clearAll(): void {
    for (const [id] of this.pending) {
      this.cancel(id);
    }
  }
}
