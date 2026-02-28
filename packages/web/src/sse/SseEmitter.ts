import { SseFormatter } from './SseFormatter.js';
import { SseEventTracker } from './SseEventTracker.js';
import type { SseEvent, SseConnectionState, SseWriteFn, SseEventId } from './types.js';

interface SseEmitterOptions {
  /** Default reconnection delay sent in every event's `retry:` field. */
  readonly retryMs?: number;
  /** Maximum number of events to keep for reconnect replay. */
  readonly maxBufferSize?: number;
}

/**
 * Manages the lifecycle of a Server-Sent Events connection.
 *
 * The emitter is decoupled from the HTTP transport via a {@link SseWriteFn}
 * that is registered via {@link addWriter}.  Multiple writers are supported
 * (e.g. for fan-out scenarios in tests).
 *
 * @example
 * ```ts
 * const emitter = new SseEmitter({ retryMs: 3000 });
 * emitter.addWriter(data => res.write(data));
 * emitter.send({ event: 'update', data: { msg: 'hello' } });
 * emitter.close();
 * ```
 */
export class SseEmitter {
  private connectionState: SseConnectionState = 'open';
  private readonly retryMs: number | undefined;
  private readonly writers = new Set<SseWriteFn>();
  private readonly formatter = new SseFormatter();
  private readonly tracker: SseEventTracker;

  constructor(options: SseEmitterOptions = {}) {
    this.retryMs = options.retryMs;
    this.tracker = new SseEventTracker(options.maxBufferSize);
  }

  /**
   * Register a write function that will receive formatted SSE strings.
   * Returns an unsubscribe callback.
   */
  addWriter(fn: SseWriteFn): () => void {
    this.writers.add(fn);
    return (): void => {
      this.writers.delete(fn);
    };
  }

  /**
   * Emit an event to all registered writers.
   *
   * - Auto-assigns an ID via {@link SseEventTracker}.
   * - Attaches the default `retry:` milliseconds when configured.
   * - No-ops if the emitter is already closed.
   */
  send<T>(event: SseEvent<T>): void {
    if (this.connectionState === 'closed') return;
    const withRetry: SseEvent<T> =
      this.retryMs !== undefined ? { retry: this.retryMs, ...event } : event;
    const tracked = this.tracker.track(withRetry);
    const formatted = this.formatter.format(tracked);
    for (const write of this.writers) write(formatted);
  }

  /**
   * Send a keep-alive comment.
   * Useful to prevent connections from timing out.
   */
  ping(comment = 'ping'): void {
    if (this.connectionState === 'closed') return;
    const formatted = this.formatter.formatComment(comment);
    for (const write of this.writers) write(formatted);
  }

  /**
   * Replay events that occurred after the given `Last-Event-ID` to a specific writer.
   * Intended to be called immediately after a client reconnects.
   */
  replay(lastEventId: SseEventId | undefined, writer: SseWriteFn): void {
    const events = this.tracker.getEventsAfter(lastEventId);
    for (const ev of events) {
      writer(this.formatter.format(ev));
    }
  }

  /**
   * Close this emitter. All subsequent {@link send} calls become no-ops.
   */
  close(): void {
    this.connectionState = 'closed';
  }

  /** Whether the emitter is currently open. */
  get isOpen(): boolean {
    return this.connectionState === 'open';
  }

  /** ID of the last event that was emitted. */
  get lastEventId(): SseEventId | undefined {
    return this.tracker.lastEventId;
  }

  /** Number of buffered (past) events available for replay. */
  get bufferedEventCount(): number {
    return this.tracker.bufferSize;
  }
}
