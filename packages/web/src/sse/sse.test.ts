/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { SseFormatter, SseEmitter, SseEventTracker } from './index';

// ─── SseFormatter ─────────────────────────────────────────────────────────────

describe('SseFormatter', () => {
  const fmt = new SseFormatter();

  it('formats data-only event', () => {
    const result = fmt.format({ data: 'hello' });
    expect(result).toContain('data: "hello"');
    expect(result.endsWith('\n\n')).toBe(true);
  });

  it('includes id field when present', () => {
    const result = fmt.format({ id: '42', data: 0 });
    expect(result).toContain('id: 42');
  });

  it('includes event type when present', () => {
    const result = fmt.format({ event: 'update', data: {} });
    expect(result).toContain('event: update');
  });

  it('includes retry field when present', () => {
    const result = fmt.format({ data: null, retry: 3000 });
    expect(result).toContain('retry: 3000');
  });

  it('omits optional fields when absent', () => {
    const result = fmt.format({ data: 1 });
    expect(result).not.toContain('id:');
    expect(result).not.toContain('event:');
    expect(result).not.toContain('retry:');
  });

  it('serializes object payload as JSON', () => {
    const result = fmt.format({ data: { x: 1, y: 2 } });
    expect(result).toContain('data: {"x":1,"y":2}');
  });

  it('formatComment() produces a colon-prefixed comment', () => {
    const result = fmt.formatComment('keep-alive');
    expect(result).toBe(': keep-alive\n\n');
  });

  describe('parse()', () => {
    it('round-trips a full event', () => {
      const original = { id: '1', event: 'chat', data: { msg: 'hi' } };
      const parsed = fmt.parse(fmt.format(original));
      expect(parsed?.id).toBe('1');
      expect(parsed?.event).toBe('chat');
      expect(parsed?.data).toStrictEqual({ msg: 'hi' });
    });

    it('returns null for completely invalid input', () => {
      expect(fmt.parse('not-sse-at-all')).toBeNull();
    });
  });
});

// ─── SseEventTracker ─────────────────────────────────────────────────────────

describe('SseEventTracker', () => {
  it('auto-assigns sequential IDs', () => {
    const tracker = new SseEventTracker();
    const e1 = tracker.track({ data: 'a' });
    const e2 = tracker.track({ data: 'b' });
    expect(e1.id).toBe('1');
    expect(e2.id).toBe('2');
    expect(tracker.currentSequence).toBe(2);
  });

  it('preserves explicit event IDs but still increments sequence', () => {
    const tracker = new SseEventTracker();
    const e = tracker.track({ id: 'custom-42', data: 'x' });
    expect(e.id).toBe('custom-42');
    expect(tracker.currentSequence).toBe(1);
  });

  it('lastEventId reflects most recently tracked event', () => {
    const tracker = new SseEventTracker();
    tracker.track({ data: 1 });
    tracker.track({ data: 2 });
    expect(tracker.lastEventId).toBe('2');
  });

  it('bufferSize counts tracked events', () => {
    const tracker = new SseEventTracker();
    tracker.track({ data: 1 });
    tracker.track({ data: 2 });
    expect(tracker.bufferSize).toBe(2);
  });

  it('getEventsAfter() returns events after given ID', () => {
    const tracker = new SseEventTracker();
    tracker.track({ data: 'a' });
    tracker.track({ data: 'b' });
    tracker.track({ data: 'c' });
    const events = tracker.getEventsAfter('1');
    expect(events).toHaveLength(2);
    expect(events[0]!.data).toBe('b');
    expect(events[1]!.data).toBe('c');
  });

  it('getEventsAfter(undefined) returns all events', () => {
    const tracker = new SseEventTracker();
    tracker.track({ data: 1 });
    tracker.track({ data: 2 });
    expect(tracker.getEventsAfter(undefined)).toHaveLength(2);
  });

  it('respects maxBufferSize and evicts oldest', () => {
    const tracker = new SseEventTracker(3);
    for (let i = 1; i <= 5; i++) tracker.track({ data: i });
    expect(tracker.bufferSize).toBe(3);
    // Only events 3, 4, 5 remain
    const remaining = tracker.getEventsAfter(undefined);
    expect(remaining.map((e) => e.data)).toStrictEqual([3, 4, 5]);
  });

  it('clear() empties the buffer', () => {
    const tracker = new SseEventTracker();
    tracker.track({ data: 1 });
    tracker.clear();
    expect(tracker.bufferSize).toBe(0);
  });
});

// ─── SseEmitter ───────────────────────────────────────────────────────────────

describe('SseEmitter', () => {
  it('delivers formatted SSE to writers', () => {
    const emitter = new SseEmitter();
    const received: string[] = [];
    emitter.addWriter((s) => received.push(s));
    emitter.send({ data: 'test' });
    expect(received).toHaveLength(1);
    expect(received[0]).toContain('data: "test"');
  });

  it('isOpen starts true, false after close()', () => {
    const emitter = new SseEmitter();
    expect(emitter.isOpen).toBe(true);
    emitter.close();
    expect(emitter.isOpen).toBe(false);
  });

  it('send() no-ops when closed', () => {
    const emitter = new SseEmitter();
    const received: string[] = [];
    emitter.addWriter((s) => received.push(s));
    emitter.close();
    emitter.send({ data: 'ignored' });
    expect(received).toHaveLength(0);
  });

  it('appends default retryMs to every event', () => {
    const emitter = new SseEmitter({ retryMs: 5000 });
    const received: string[] = [];
    emitter.addWriter((s) => received.push(s));
    emitter.send({ data: 'x' });
    expect(received[0]).toContain('retry: 5000');
  });

  it('does not override explicit event retry', () => {
    const emitter = new SseEmitter({ retryMs: 5000 });
    const received: string[] = [];
    emitter.addWriter((s) => received.push(s));
    emitter.send({ data: 'x', retry: 100 });
    // Event-level retry takes precedence (spread order: retryMs first, event retry overwrites)
    expect(received[0]).toContain('retry: 100');
  });

  it('lastEventId returns most recent ID', () => {
    const emitter = new SseEmitter();
    emitter.addWriter(() => undefined);
    emitter.send({ data: 'a' });
    emitter.send({ data: 'b' });
    expect(emitter.lastEventId).toBe('2');
  });

  it('bufferedEventCount tracks sent events', () => {
    const emitter = new SseEmitter();
    emitter.addWriter(() => undefined);
    emitter.send({ data: 1 });
    emitter.send({ data: 2 });
    expect(emitter.bufferedEventCount).toBe(2);
  });

  it('unsubscribe returned by addWriter removes writer', () => {
    const emitter = new SseEmitter();
    const received: string[] = [];
    const unsub = emitter.addWriter((s) => received.push(s));
    unsub();
    emitter.send({ data: 'x' });
    expect(received).toHaveLength(0);
  });

  it('ping() sends comment to writers', () => {
    const emitter = new SseEmitter();
    const received: string[] = [];
    emitter.addWriter((s) => received.push(s));
    emitter.ping();
    expect(received[0]).toBe(': ping\n\n');
  });

  it('replay() sends missed events from lastEventId', () => {
    const emitter = new SseEmitter();
    emitter.addWriter(() => undefined); // need writer so buffer fills
    emitter.send({ data: 'msg1' });
    emitter.send({ data: 'msg2' });
    emitter.send({ data: 'msg3' });

    const replayed: string[] = [];
    emitter.replay('1', (s) => replayed.push(s));
    expect(replayed).toHaveLength(2);
    expect(replayed[0]).toContain('msg2');
    expect(replayed[1]).toContain('msg3');
  });
});
