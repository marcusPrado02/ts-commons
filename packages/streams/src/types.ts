/** Subscriber callback receiving each emitted value. */
export type Subscriber<T> = (value: T) => void;

/** Unsubscribe handle returned by stream subscriptions. */
export interface Subscription {
  unsubscribe(): void;
}

/** Completion callback indicating the stream ended. */
export type CompletionCallback = () => void;

/** Error callback for stream errors. */
export type ErrorCallback = (err: unknown) => void;

/** Full observer contract for an event stream. */
export interface Observer<T> {
  next: Subscriber<T>;
  error?: ErrorCallback;
  complete?: CompletionCallback;
}

/** Backpressure strategy when a queue is full. */
export type BackpressureStrategy = 'drop_newest' | 'drop_oldest' | 'buffer';

/** Window type for stream windowing operations. */
export type WindowType = 'tumbling' | 'sliding' | 'session';

/** A collected window of values with its open/close timestamps. */
export interface StreamWindow<T> {
  values: T[];
  openedAt: number;
  closedAt: number;
}

/** Result of a split operation – two sub-streams identified by keys. */
export interface SplitStreams<T> {
  matching: ReadonlyArray<T>;
  nonMatching: ReadonlyArray<T>;
}
