/**
 * Unique identifier for an SSE event, used by clients when reconnecting
 * via the `Last-Event-ID` header.
 */
export type SseEventId = string;

/**
 * A structured SSE event ready to be formatted and sent over the wire.
 */
export interface SseEvent<T = unknown> {
  /** Optional event ID. Auto-assigned by {@link SseEmitter} when omitted. */
  readonly id?: SseEventId;
  /** Custom event type name (maps to `event:` field). Defaults to `"message"`. */
  readonly event?: string;
  /** Payload — will be JSON-serialised. */
  readonly data: T;
  /** Override the client reconnection delay in milliseconds (`retry:` field). */
  readonly retry?: number;
}

/**
 * Lifecycle state of an SSE connection.
 */
export type SseConnectionState = 'open' | 'closed';

/**
 * A handler that receives raw formatted SSE strings and writes them to the
 * underlying transport (e.g. `res.write(...)`).
 */
export type SseWriteFn = (formatted: string) => void;
