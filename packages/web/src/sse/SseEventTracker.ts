import type { SseEvent, SseEventId } from './types.js';

/**
 * Maintains a bounded in-memory log of sent events keyed by their sequential numeric ID.
 *
 * Supports the SSE reconnection pattern where a reconnecting client sends
 * `Last-Event-ID` and the server replays missed events.
 */
export class SseEventTracker {
  private readonly buffer: Array<SseEvent<unknown>> = [];
  private readonly maxBufferSize: number;
  private sequence = 0;

  constructor(maxBufferSize = 100) {
    this.maxBufferSize = maxBufferSize;
  }

  /**
   * Record a sent event. Assigns an auto-incrementing numeric ID if the event
   * does not already have one, and returns the (possibly mutated) event with ID.
   */
  track<T>(event: SseEvent<T>): SseEvent<T> & { id: SseEventId } {
    this.sequence++;
    const id = event.id ?? String(this.sequence);
    const tracked = { ...event, id } as SseEvent<T> & { id: SseEventId };
    this.buffer.push(tracked as SseEvent<unknown>);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.splice(0, this.buffer.length - this.maxBufferSize);
    }
    return tracked;
  }

  /**
   * Returns all buffered events whose numeric ID is greater than `lastEventId`.
   * If `lastEventId` is `undefined` or cannot be parsed, returns all buffered events.
   */
  getEventsAfter(lastEventId: SseEventId | undefined): ReadonlyArray<SseEvent<unknown>> {
    if (lastEventId === undefined) return [...this.buffer];
    const threshold = Number(lastEventId);
    if (isNaN(threshold)) return [...this.buffer];
    return this.buffer.filter((e) => Number(e.id) > threshold);
  }

  /** The ID of the most recently tracked event. */
  get lastEventId(): SseEventId | undefined {
    const last = this.buffer[this.buffer.length - 1];
    return last?.id;
  }

  /** Number of buffered events. */
  get bufferSize(): number {
    return this.buffer.length;
  }

  /** Current sequence counter (equals total unique events tracked). */
  get currentSequence(): number {
    return this.sequence;
  }

  /** Clear the buffer. */
  clear(): void {
    this.buffer.splice(0, this.buffer.length);
  }
}
