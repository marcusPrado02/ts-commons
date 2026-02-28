import type { BackpressureStrategy } from './types.js';

/**
 * A bounded queue with configurable {@link BackpressureStrategy}.
 *
 * When the queue is full a `drop_newest` strategy silently discards the
 * incoming item; `drop_oldest` evicts the front element to make room;
 * `buffer` grows without bound (no limit enforced).
 *
 * @example
 * ```ts
 * const q = new BackpressureQueue<number>({ maxSize: 3, strategy: 'drop_oldest' });
 * q.enqueue(1); q.enqueue(2); q.enqueue(3); q.enqueue(4);
 * console.log(q.dequeue()); // 2 (1 was dropped)
 * ```
 */
export class BackpressureQueue<T> {
  private readonly items: T[] = [];
  private readonly maxSize: number;
  private readonly strategy: BackpressureStrategy;
  private droppedCount = 0;

  constructor(options: { maxSize: number; strategy: BackpressureStrategy }) {
    this.maxSize = options.maxSize;
    this.strategy = options.strategy;
  }

  /** Add an item to the queue, applying the backpressure strategy when full. */
  enqueue(item: T): void {
    if (this.strategy === 'buffer') {
      this.items.push(item);
      return;
    }
    if (this.items.length < this.maxSize) {
      this.items.push(item);
      return;
    }
    this.applyPressure(item);
  }

  /** Remove and return the front item; returns `undefined` if empty. */
  dequeue(): T | undefined {
    return this.items.shift();
  }

  /** Peek at the front item without removing it. */
  peek(): T | undefined {
    return this.items[0];
  }

  /** Current number of items in the queue. */
  get size(): number {
    return this.items.length;
  }

  /** Whether the queue is empty. */
  get isEmpty(): boolean {
    return this.items.length === 0;
  }

  /** Whether the queue is at capacity (not applicable to `buffer` strategy). */
  get isFull(): boolean {
    return this.strategy !== 'buffer' && this.items.length >= this.maxSize;
  }

  /** Total number of items dropped due to backpressure. */
  get dropped(): number {
    return this.droppedCount;
  }

  /** Drain all items in FIFO order. */
  drain(): T[] {
    return this.items.splice(0);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private applyPressure(item: T): void {
    if (this.strategy === 'drop_newest') {
      this.droppedCount++;
      return;
    }
    // drop_oldest: evict front to make room
    this.items.shift();
    this.droppedCount++;
    this.items.push(item);
  }
}
