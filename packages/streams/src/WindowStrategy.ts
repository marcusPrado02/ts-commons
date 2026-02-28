import { EventStream } from './EventStream.js';
import type { StreamWindow } from './types.js';

/**
 * Groups items from a source stream into time-based or count-based windows.
 *
 * Three window types are supported:
 * - **tumbling** — fixed-size, non-overlapping count buckets
 * - **sliding** — overlapping windows of `size` shifted by `step`
 * - **session** — gap-based windows closed when no items arrive within `gapMs`
 */
export class WindowStrategy<T> {
  /**
   * Tumbling window: collect `windowSize` items then emit the batch, repeat.
   */
  tumbling(source: EventStream<T>, windowSize: number): EventStream<StreamWindow<T>> {
    const out = new EventStream<StreamWindow<T>>();
    let buffer: T[] = [];
    let openedAt = Date.now();

    source.subscribe({
      next: (v) => {
        buffer.push(v);
        if (buffer.length >= windowSize) {
          out.emit({ values: buffer, openedAt, closedAt: Date.now() });
          buffer = [];
          openedAt = Date.now();
        }
      },
      error: (e) => out.error(e),
      complete: () => {
        if (buffer.length > 0) {
          out.emit({ values: buffer, openedAt, closedAt: Date.now() });
        }
        out.complete();
      },
    });
    return out;
  }

  /**
   * Sliding window: emit a window of `size` items every `step` items.
   * The ring-buffer always contains the last `size` items seen.
   */
  sliding(source: EventStream<T>, size: number, step: number): EventStream<StreamWindow<T>> {
    const out = new EventStream<StreamWindow<T>>();
    const ring: T[] = [];
    let count = 0;
    const ringOpenedAt: number[] = [];

    source.subscribe({
      next: (v) => {
        ring.push(v);
        ringOpenedAt.push(Date.now());
        if (ring.length > size) {
          ring.shift();
          ringOpenedAt.shift();
        }
        count++;
        if (count % step === 0 && ring.length === size) {
          out.emit({
            values: [...ring],
            openedAt: ringOpenedAt[0] ?? Date.now(),
            closedAt: Date.now(),
          });
        }
      },
      error: (e) => out.error(e),
      complete: () => out.complete(),
    });
    return out;
  }

  /**
   * Session window: emit accumulated items when a gap of `gapMs` ms passes
   * without a new item.  Driven by calls to `tick(currentTimeMs)` on the
   * returned controller rather than real timers, making it fully testable.
   */
  session(
    source: EventStream<T>,
    gapMs: number,
  ): { windows: EventStream<StreamWindow<T>>; tick: (nowMs: number) => void } {
    const out = new EventStream<StreamWindow<T>>();
    let buffer: T[] = [];
    let lastEmitMs = 0;
    let openedAt = 0;
    let hasItems = false;

    source.subscribe({
      next: (v) => {
        if (!hasItems) {
          openedAt = Date.now();
          hasItems = true;
        }
        buffer.push(v);
        lastEmitMs = Date.now();
      },
      error: (e) => out.error(e),
      complete: () => {
        if (buffer.length > 0) {
          out.emit({ values: buffer, openedAt, closedAt: Date.now() });
          buffer = [];
          hasItems = false;
        }
        out.complete();
      },
    });

    const tick = (nowMs: number): void => {
      if (hasItems && nowMs - lastEmitMs >= gapMs) {
        out.emit({ values: buffer, openedAt, closedAt: nowMs });
        buffer = [];
        hasItems = false;
        lastEmitMs = nowMs;
      }
    };

    return { windows: out, tick };
  }
}
