/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { EventStream, BackpressureQueue, StreamMerger, WindowStrategy } from './index.js';

// ─── EventStream ──────────────────────────────────────────────────────────────

describe('EventStream', () => {
  it('delivers emitted values to subscribers', () => {
    const stream = new EventStream<number>();
    const received: number[] = [];
    stream.subscribe({ next: (v) => received.push(v) });
    stream.emit(1);
    stream.emit(2);
    stream.emit(3);
    expect(received).toStrictEqual([1, 2, 3]);
  });

  it('multiple subscribers each receive values', () => {
    const stream = new EventStream<string>();
    const a: string[] = [];
    const b: string[] = [];
    stream.subscribe({ next: (v) => a.push(v) });
    stream.subscribe({ next: (v) => b.push(v) });
    stream.emit('hello');
    expect(a).toStrictEqual(['hello']);
    expect(b).toStrictEqual(['hello']);
  });

  it('unsubscribed observer stops receiving values', () => {
    const stream = new EventStream<number>();
    const received: number[] = [];
    const sub = stream.subscribe({ next: (v) => received.push(v) });
    stream.emit(1);
    sub.unsubscribe();
    stream.emit(2);
    expect(received).toStrictEqual([1]);
  });

  it('complete() calls complete callbacks', () => {
    const stream = new EventStream<number>();
    const completed = vi.fn();
    stream.subscribe({ next: () => undefined, complete: completed });
    stream.complete();
    expect(completed).toHaveBeenCalledOnce();
  });

  it('no values emitted after complete()', () => {
    const stream = new EventStream<number>();
    const received: number[] = [];
    stream.subscribe({ next: (v) => received.push(v) });
    stream.complete();
    stream.emit(1);
    expect(received).toStrictEqual([]);
  });

  it('error() calls error callbacks', () => {
    const stream = new EventStream<number>();
    const onError = vi.fn();
    stream.subscribe({ next: () => undefined, error: onError });
    stream.error(new Error('boom'));
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }));
  });

  it('no values emitted after error()', () => {
    const stream = new EventStream<number>();
    const received: number[] = [];
    stream.subscribe({ next: (v) => received.push(v) });
    stream.error('fail');
    stream.emit(99);
    expect(received).toStrictEqual([]);
  });

  it('subscriberCount tracks active subscriptions', () => {
    const stream = new EventStream<number>();
    const s1 = stream.subscribe({ next: () => undefined });
    const s2 = stream.subscribe({ next: () => undefined });
    expect(stream.subscriberCount).toBe(2);
    s1.unsubscribe();
    expect(stream.subscriberCount).toBe(1);
    s2.unsubscribe();
    expect(stream.subscriberCount).toBe(0);
  });

  it('isCompleted is true after complete()', () => {
    const s = new EventStream<number>();
    expect(s.isCompleted).toBe(false);
    s.complete();
    expect(s.isCompleted).toBe(true);
  });

  it('isErrored is true after error()', () => {
    const s = new EventStream<number>();
    s.error('boom');
    expect(s.isErrored).toBe(true);
  });

  describe('map()', () => {
    it('transforms values', () => {
      const src = new EventStream<number>();
      const out: number[] = [];
      src.map((v) => v * 2).subscribe({ next: (v) => out.push(v) });
      src.emit(3);
      src.emit(5);
      expect(out).toStrictEqual([6, 10]);
    });

    it('propagates complete', () => {
      const src = new EventStream<number>();
      const done = vi.fn();
      src.map((v) => v).subscribe({ next: () => undefined, complete: done });
      src.complete();
      expect(done).toHaveBeenCalledOnce();
    });
  });

  describe('filter()', () => {
    it('only emits values matching predicate', () => {
      const src = new EventStream<number>();
      const out: number[] = [];
      src.filter((v) => v % 2 === 0).subscribe({ next: (v) => out.push(v) });
      src.emit(1);
      src.emit(2);
      src.emit(3);
      src.emit(4);
      expect(out).toStrictEqual([2, 4]);
    });
  });

  describe('take()', () => {
    it('takes exactly N values then completes', () => {
      const src = new EventStream<number>();
      const out: number[] = [];
      const done = vi.fn();
      src.take(2).subscribe({ next: (v) => out.push(v), complete: done });
      src.emit(1);
      src.emit(2);
      src.emit(3);
      expect(out).toStrictEqual([1, 2]);
      expect(done).toHaveBeenCalledOnce();
    });
  });

  describe('skip()', () => {
    it('skips first N values', () => {
      const src = new EventStream<number>();
      const out: number[] = [];
      src.skip(2).subscribe({ next: (v) => out.push(v) });
      src.emit(1);
      src.emit(2);
      src.emit(3);
      src.emit(4);
      expect(out).toStrictEqual([3, 4]);
    });
  });
});

// ─── BackpressureQueue ────────────────────────────────────────────────────────

describe('BackpressureQueue', () => {
  it('enqueues and dequeues in FIFO order', () => {
    const q = new BackpressureQueue<number>({ maxSize: 10, strategy: 'drop_newest' });
    q.enqueue(1);
    q.enqueue(2);
    q.enqueue(3);
    expect(q.dequeue()).toBe(1);
    expect(q.dequeue()).toBe(2);
  });

  it('size reflects item count', () => {
    const q = new BackpressureQueue<string>({ maxSize: 5, strategy: 'drop_newest' });
    q.enqueue('a');
    q.enqueue('b');
    expect(q.size).toBe(2);
  });

  it('isEmpty returns true when empty', () => {
    const q = new BackpressureQueue<number>({ maxSize: 5, strategy: 'drop_newest' });
    expect(q.isEmpty).toBe(true);
    q.enqueue(1);
    expect(q.isEmpty).toBe(false);
  });

  it('isFull returns true at capacity', () => {
    const q = new BackpressureQueue<number>({ maxSize: 2, strategy: 'drop_newest' });
    q.enqueue(1);
    q.enqueue(2);
    expect(q.isFull).toBe(true);
  });

  it('drop_newest: discards incoming items when full', () => {
    const q = new BackpressureQueue<number>({ maxSize: 2, strategy: 'drop_newest' });
    q.enqueue(1);
    q.enqueue(2);
    q.enqueue(3);
    expect(q.size).toBe(2);
    expect(q.dropped).toBe(1);
    expect(q.dequeue()).toBe(1);
    expect(q.dequeue()).toBe(2);
  });

  it('drop_oldest: evicts front item to make room', () => {
    const q = new BackpressureQueue<number>({ maxSize: 2, strategy: 'drop_oldest' });
    q.enqueue(1);
    q.enqueue(2);
    q.enqueue(3);
    expect(q.size).toBe(2);
    expect(q.dropped).toBe(1);
    expect(q.dequeue()).toBe(2);
    expect(q.dequeue()).toBe(3);
  });

  it('buffer strategy grows beyond maxSize', () => {
    const q = new BackpressureQueue<number>({ maxSize: 2, strategy: 'buffer' });
    q.enqueue(1);
    q.enqueue(2);
    q.enqueue(3);
    expect(q.size).toBe(3);
    expect(q.dropped).toBe(0);
  });

  it('peek returns front without removing', () => {
    const q = new BackpressureQueue<number>({ maxSize: 5, strategy: 'drop_newest' });
    q.enqueue(42);
    expect(q.peek()).toBe(42);
    expect(q.size).toBe(1);
  });

  it('drain empties queue and returns all items', () => {
    const q = new BackpressureQueue<number>({ maxSize: 5, strategy: 'drop_newest' });
    q.enqueue(1);
    q.enqueue(2);
    q.enqueue(3);
    const items = q.drain();
    expect(items).toStrictEqual([1, 2, 3]);
    expect(q.isEmpty).toBe(true);
  });
});

// ─── StreamMerger ─────────────────────────────────────────────────────────────

describe('StreamMerger', () => {
  const merger = new StreamMerger();

  it('merge() emits values from all sources', () => {
    const a = new EventStream<number>();
    const b = new EventStream<number>();
    const out: number[] = [];
    merger.merge([a, b]).subscribe({ next: (v) => out.push(v) });
    a.emit(1);
    b.emit(2);
    a.emit(3);
    expect(out).toStrictEqual([1, 2, 3]);
  });

  it('merge() completes when all sources complete', () => {
    const a = new EventStream<number>();
    const b = new EventStream<number>();
    const done = vi.fn();
    merger.merge([a, b]).subscribe({ next: () => undefined, complete: done });
    a.complete();
    expect(done).not.toHaveBeenCalled();
    b.complete();
    expect(done).toHaveBeenCalledOnce();
  });

  it('merge() with empty array completes immediately', () => {
    const done = vi.fn();
    merger.merge([]).subscribe({ next: () => undefined, complete: done });
    expect(done).toHaveBeenCalledOnce();
  });

  it('combineLatest() emits pairs from two streams', () => {
    const a = new EventStream<number>();
    const b = new EventStream<string>();
    const out: [number, string][] = [];
    merger.combineLatest(a, b).subscribe({ next: (v) => out.push(v) });
    a.emit(1);
    b.emit('x');
    expect(out).toStrictEqual([[1, 'x']]);
  });

  it('combineLatest() does not emit until both have values', () => {
    const a = new EventStream<number>();
    const b = new EventStream<number>();
    const out: [number, number][] = [];
    merger.combineLatest(a, b).subscribe({ next: (v) => out.push(v) });
    a.emit(10);
    expect(out).toHaveLength(0);
    b.emit(20);
    expect(out).toHaveLength(1);
  });

  it('split() routes values by predicate', () => {
    const src = new EventStream<number>();
    const evens: number[] = [];
    const odds: number[] = [];
    const { matching, nonMatching } = merger.split(src, (v) => v % 2 === 0);
    matching.subscribe({ next: (v) => evens.push(v) });
    nonMatching.subscribe({ next: (v) => odds.push(v) });
    src.emit(1);
    src.emit(2);
    src.emit(3);
    src.emit(4);
    expect(evens).toStrictEqual([2, 4]);
    expect(odds).toStrictEqual([1, 3]);
  });

  it('zip() pairs values in order', () => {
    const a = new EventStream<number>();
    const b = new EventStream<string>();
    const out: [number, string][] = [];
    merger.zip(a, b).subscribe({ next: (v) => out.push(v) });
    a.emit(1);
    a.emit(2);
    b.emit('a');
    b.emit('b');
    expect(out).toStrictEqual([
      [1, 'a'],
      [2, 'b'],
    ]);
  });
});

// ─── WindowStrategy ───────────────────────────────────────────────────────────

describe('WindowStrategy', () => {
  const ws = new WindowStrategy<number>();

  it('tumbling() emits fixed-size windows', () => {
    const src = new EventStream<number>();
    const windows: number[][] = [];
    ws.tumbling(src, 3).subscribe({ next: (w) => windows.push(w.values) });
    [1, 2, 3, 4, 5, 6].forEach((v) => src.emit(v));
    expect(windows).toStrictEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });

  it('tumbling() flushes partial window on complete', () => {
    const src = new EventStream<number>();
    const windows: number[][] = [];
    ws.tumbling(src, 3).subscribe({ next: (w) => windows.push(w.values) });
    src.emit(1);
    src.emit(2);
    src.complete();
    expect(windows).toHaveLength(1);
    expect(windows[0]).toStrictEqual([1, 2]);
  });

  it('tumbling() window has openedAt <= closedAt', () => {
    const src = new EventStream<number>();
    let captured: { openedAt: number; closedAt: number } | undefined;
    ws.tumbling(src, 2).subscribe({
      next: (w) => {
        captured = w;
      },
    });
    src.emit(1);
    src.emit(2);
    expect(captured?.openedAt).toBeLessThanOrEqual(captured?.closedAt ?? 0);
  });

  it('sliding() emits overlapping windows every step items', () => {
    const src = new EventStream<number>();
    const windows: number[][] = [];
    ws.sliding(src, 3, 1).subscribe({ next: (w) => windows.push([...w.values]) });
    [1, 2, 3, 4, 5].forEach((v) => src.emit(v));
    expect(windows[0]).toStrictEqual([1, 2, 3]);
    expect(windows[1]).toStrictEqual([2, 3, 4]);
    expect(windows[2]).toStrictEqual([3, 4, 5]);
  });

  it('session() emits window when tick detects gap', () => {
    const src = new EventStream<number>();
    const windows: number[][] = [];
    const { windows: ws$, tick } = ws.session(src, 100);
    ws$.subscribe({ next: (w) => windows.push(w.values) });
    src.emit(1);
    src.emit(2);
    tick(Date.now() + 200);
    expect(windows).toHaveLength(1);
    expect(windows[0]).toStrictEqual([1, 2]);
  });

  it('session() accumulates across multiple events before gap', () => {
    const src = new EventStream<number>();
    const windows: number[][] = [];
    const { windows: ws$, tick } = ws.session(src, 50);
    ws$.subscribe({ next: (w) => windows.push(w.values) });
    src.emit(10);
    src.emit(20);
    src.emit(30);
    tick(Date.now() + 100);
    expect(windows[0]).toStrictEqual([10, 20, 30]);
  });
});
