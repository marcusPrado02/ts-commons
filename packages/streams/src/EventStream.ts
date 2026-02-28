import type {
  Observer,
  Subscription,
  Subscriber,
  CompletionCallback,
  ErrorCallback,
} from './types.js';

interface SubscriberEntry<T> {
  next: Subscriber<T>;
  error?: ErrorCallback;
  complete?: CompletionCallback;
}

/**
 * A lightweight push-based event stream (observable pattern).
 *
 * Subscribers receive values as they are emitted via {@link emit}.
 * The stream can be completed or errored to signal lifecycle events.
 *
 * @example
 * ```ts
 * const stream = new EventStream<number>();
 * const sub = stream.subscribe({ next: v => console.log(v) });
 * stream.emit(1);
 * stream.complete();
 * sub.unsubscribe();
 * ```
 */
export class EventStream<T> {
  private readonly subscribers = new Map<number, SubscriberEntry<T>>();
  private nextId = 0;
  private completed = false;
  private errorState: unknown = undefined;
  private hasError = false;

  /** Subscribe to values emitted by this stream. */
  subscribe(observer: Observer<T>): Subscription {
    // If already completed or errored, notify immediately.
    if (this.completed) {
      if (observer.complete !== undefined) observer.complete();
      return { unsubscribe: (): void => undefined };
    }
    if (this.hasError) {
      if (observer.error !== undefined) observer.error(this.errorState);
      return { unsubscribe: (): void => undefined };
    }
    const id = this.nextId++;
    this.subscribers.set(id, {
      next: observer.next,
      error: observer.error,
      complete: observer.complete,
    });
    return {
      unsubscribe: (): void => {
        this.subscribers.delete(id);
      },
    };
  }

  /** Emit a value to all current subscribers. */
  emit(value: T): void {
    if (this.completed || this.hasError) return;
    for (const sub of this.subscribers.values()) {
      sub.next(value);
    }
  }

  /** Signal an error to all current subscribers. */
  error(err: unknown): void {
    if (this.completed || this.hasError) return;
    this.hasError = true;
    this.errorState = err;
    for (const sub of this.subscribers.values()) {
      if (sub.error !== undefined) sub.error(err);
    }
  }

  /** Signal that no more values will be emitted. */
  complete(): void {
    if (this.completed || this.hasError) return;
    this.completed = true;
    for (const sub of this.subscribers.values()) {
      if (sub.complete !== undefined) sub.complete();
    }
  }

  /** Returns `true` if {@link complete} has been called. */
  get isCompleted(): boolean {
    return this.completed;
  }

  /** Returns `true` if {@link error} has been called. */
  get isErrored(): boolean {
    return this.hasError;
  }

  /** Number of active subscribers. */
  get subscriberCount(): number {
    return this.subscribers.size;
  }

  /**
   * Return a new stream that emits values transformed by `fn`.
   */
  map<U>(fn: (value: T) => U): EventStream<U> {
    const out = new EventStream<U>();
    this.subscribe({
      next: (v) => out.emit(fn(v)),
      error: (e) => out.error(e),
      complete: () => out.complete(),
    });
    return out;
  }

  /**
   * Return a new stream that only emits values satisfying `predicate`.
   */
  filter(predicate: (value: T) => boolean): EventStream<T> {
    const out = new EventStream<T>();
    this.subscribe({
      next: (v) => {
        if (predicate(v)) out.emit(v);
      },
      error: (e) => out.error(e),
      complete: () => out.complete(),
    });
    return out;
  }

  /**
   * Return a new stream that completes after emitting the first `count` values.
   */
  take(count: number): EventStream<T> {
    const out = new EventStream<T>();
    let seen = 0;
    const sub = this.subscribe({
      next: (v) => {
        if (seen < count) {
          seen++;
          out.emit(v);
          if (seen >= count) {
            out.complete();
            sub.unsubscribe();
          }
        }
      },
      error: (e) => out.error(e),
      complete: () => out.complete(),
    });
    return out;
  }

  /**
   * Return a new stream that skips the first `count` values.
   */
  skip(count: number): EventStream<T> {
    const out = new EventStream<T>();
    let skipped = 0;
    this.subscribe({
      next: (v) => {
        if (skipped < count) {
          skipped++;
          return;
        }
        out.emit(v);
      },
      error: (e) => out.error(e),
      complete: () => out.complete(),
    });
    return out;
  }
}
