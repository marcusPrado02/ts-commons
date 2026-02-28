import { EventStream } from './EventStream.js';

/**
 * Utilities for combining and splitting {@link EventStream} instances.
 */
export class StreamMerger {
  /**
   * Merge multiple source streams into a single output stream.
   * The output emits every value from every source.
   * It completes when **all** sources have completed.
   */
  merge<T>(streams: readonly EventStream<T>[]): EventStream<T> {
    const out = new EventStream<T>();
    if (streams.length === 0) {
      out.complete();
      return out;
    }
    let completedCount = 0;
    for (const stream of streams) {
      stream.subscribe({
        next: (v) => out.emit(v),
        error: (e) => out.error(e),
        complete: () => {
          completedCount++;
          if (completedCount === streams.length) out.complete();
        },
      });
    }
    return out;
  }

  /**
   * Combine the latest values from two streams.
   * Emits a `[a, b]` tuple whenever either source emits,
   * but only after both have emitted at least one value.
   */
  combineLatest<A, B>(a: EventStream<A>, b: EventStream<B>): EventStream<[A, B]> {
    const out = new EventStream<[A, B]>();
    let latestA: A | undefined;
    let latestB: B | undefined;
    let hasA = false;
    let hasB = false;

    a.subscribe({
      next: (v) => {
        latestA = v;
        hasA = true;
        if (hasB) out.emit([v, latestB as B]);
      },
      error: (e) => out.error(e),
    });
    b.subscribe({
      next: (v) => {
        latestB = v;
        hasB = true;
        if (hasA) out.emit([latestA as A, v]);
      },
      error: (e) => out.error(e),
    });
    return out;
  }

  /**
   * Split a stream into two by a predicate.
   * Returns `{ matching, nonMatching }` streams.
   */
  split<T>(
    source: EventStream<T>,
    predicate: (value: T) => boolean,
  ): { matching: EventStream<T>; nonMatching: EventStream<T> } {
    const matching = new EventStream<T>();
    const nonMatching = new EventStream<T>();
    source.subscribe({
      next: (v) => {
        if (predicate(v)) matching.emit(v);
        else nonMatching.emit(v);
      },
      error: (e) => {
        matching.error(e);
        nonMatching.error(e);
      },
      complete: () => {
        matching.complete();
        nonMatching.complete();
      },
    });
    return { matching, nonMatching };
  }

  /**
   * Zip two streams: emit `[a, b]` pairs when each stream has produced
   * a corresponding value. Buffers earlier values until their counterpart arrives.
   */
  zip<A, B>(a: EventStream<A>, b: EventStream<B>): EventStream<[A, B]> {
    const out = new EventStream<[A, B]>();
    const bufA: A[] = [];
    const bufB: B[] = [];

    a.subscribe({
      next: (v) => {
        bufA.push(v);
        this.tryEmitZip(out, bufA, bufB);
      },
      error: (e) => out.error(e),
    });
    b.subscribe({
      next: (v) => {
        bufB.push(v);
        this.tryEmitZip(out, bufA, bufB);
      },
      error: (e) => out.error(e),
    });
    return out;
  }

  private tryEmitZip<A, B>(out: EventStream<[A, B]>, bufA: A[], bufB: B[]): void {
    while (bufA.length > 0 && bufB.length > 0) {
      out.emit([bufA.shift() as A, bufB.shift() as B]);
    }
  }
}
