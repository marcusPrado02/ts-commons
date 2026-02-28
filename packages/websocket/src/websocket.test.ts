/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { WebSocketConnection, WebSocketServer, RoomManager, ReconnectionHandler } from './index.js';
import type { SocketAdapter, AuthenticatorFn } from './index.js';

// ─── Test helpers ─────────────────────────────────────────────────────────────

let adapterSeq = 0;

function makeAdapter(id?: string): SocketAdapter & { sent: string[]; closed: boolean } {
  const adapterId = id ?? `conn-${++adapterSeq}`;
  return {
    id: adapterId,
    sent: [] as string[],
    closed: false,
    send(data: string): void {
      this.sent.push(data);
    },
    close(): void {
      this.closed = true;
    },
  };
}

function makeMsg(type = 'chat', payload: unknown = {}) {
  return { type, payload, connectionId: 'sender', timestamp: Date.now() };
}

const allowAll: AuthenticatorFn = (token) => ({ authenticated: true, userId: `user-${token}` });
const denyAll: AuthenticatorFn = () => ({ authenticated: false, reason: 'denied' });

// ─── WebSocketConnection ──────────────────────────────────────────────────────

describe('WebSocketConnection', () => {
  it('has correct id from adapter', () => {
    const adapter = makeAdapter('abc');
    const conn = new WebSocketConnection(adapter);
    expect(conn.id).toBe('abc');
  });

  it('initial state is connected', () => {
    const conn = new WebSocketConnection(makeAdapter());
    expect(conn.state).toBe('connected');
  });

  it('send() serializes message to adapter', () => {
    const adapter = makeAdapter();
    const conn = new WebSocketConnection(adapter);
    conn.send(makeMsg('ping', { x: 1 }));
    expect(adapter.sent).toHaveLength(1);
    const parsed = JSON.parse(adapter.sent[0]!);
    expect(parsed.type).toBe('ping');
  });

  it('send() no-ops when disconnected', () => {
    const adapter = makeAdapter();
    const conn = new WebSocketConnection(adapter);
    conn.disconnect();
    conn.send(makeMsg());
    expect(adapter.sent).toHaveLength(0);
  });

  it('disconnect() closes adapter and changes state', () => {
    const adapter = makeAdapter();
    const conn = new WebSocketConnection(adapter);
    conn.disconnect();
    expect(conn.state).toBe('disconnected');
    expect(adapter.closed).toBe(true);
  });

  it('duplicate disconnect() is safe', () => {
    const adapter = makeAdapter();
    const conn = new WebSocketConnection(adapter);
    conn.disconnect();
    conn.disconnect();
    expect(conn.state).toBe('disconnected');
  });

  it('receive() dispatches to on() handlers', () => {
    const conn = new WebSocketConnection(makeAdapter());
    const handler = vi.fn();
    conn.on('chat', handler);
    conn.receive(
      JSON.stringify({ type: 'chat', payload: 'hello', connectionId: 'x', timestamp: 0 }),
    );
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0]![0].payload).toBe('hello');
  });

  it('receive() ignores unknown types', () => {
    const conn = new WebSocketConnection(makeAdapter());
    const handler = vi.fn();
    conn.on('chat', handler);
    conn.receive(JSON.stringify({ type: 'other' }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('receive() ignores malformed JSON', () => {
    const conn = new WebSocketConnection(makeAdapter());
    expect(() => conn.receive('not-json')).not.toThrow();
  });

  it('off() removes handler', () => {
    const conn = new WebSocketConnection(makeAdapter());
    const handler = vi.fn();
    conn.on('ev', handler);
    conn.off('ev', handler);
    conn.receive(JSON.stringify({ type: 'ev', payload: null, connectionId: '', timestamp: 0 }));
    expect(handler).not.toHaveBeenCalled();
  });

  describe('authenticate()', () => {
    it('returns success with allow-all authenticator', () => {
      const conn = new WebSocketConnection(makeAdapter(), { authenticator: allowAll });
      const result = conn.authenticate('tok123');
      expect(result.authenticated).toBe(true);
      expect(result.userId).toBe('user-tok123');
      expect(conn.isAuthenticated).toBe(true);
      expect(conn.userId).toBe('user-tok123');
    });

    it('returns failure with deny-all authenticator', () => {
      const conn = new WebSocketConnection(makeAdapter(), { authenticator: denyAll });
      const result = conn.authenticate('tok');
      expect(result.authenticated).toBe(false);
      expect(conn.isAuthenticated).toBe(false);
    });

    it('returns failure when no authenticator configured', () => {
      const conn = new WebSocketConnection(makeAdapter());
      const result = conn.authenticate('tok');
      expect(result.authenticated).toBe(false);
    });
  });
});

// ─── RoomManager ─────────────────────────────────────────────────────────────

describe('RoomManager', () => {
  it('join() adds connection to room', () => {
    const rm = new RoomManager();
    rm.join('c1', 'room-a');
    expect(rm.getRoomMembers('room-a')).toContain('c1');
  });

  it('isMember() reflects membership', () => {
    const rm = new RoomManager();
    rm.join('c1', 'r1');
    expect(rm.isMember('c1', 'r1')).toBe(true);
    expect(rm.isMember('c1', 'r2')).toBe(false);
  });

  it('leave() removes connection from room', () => {
    const rm = new RoomManager();
    rm.join('c1', 'r1');
    rm.leave('c1', 'r1');
    expect(rm.isMember('c1', 'r1')).toBe(false);
  });

  it('leave() prunes empty room', () => {
    const rm = new RoomManager();
    rm.join('c1', 'r1');
    rm.leave('c1', 'r1');
    expect(rm.roomCount).toBe(0);
  });

  it('leaveAll() removes from all rooms', () => {
    const rm = new RoomManager();
    rm.join('c1', 'r1');
    rm.join('c1', 'r2');
    rm.leaveAll('c1');
    expect(rm.getConnectionRooms('c1')).toHaveLength(0);
    expect(rm.roomCount).toBe(0);
  });

  it('getRoomMembers() returns all members', () => {
    const rm = new RoomManager();
    rm.join('c1', 'r1');
    rm.join('c2', 'r1');
    expect(rm.getRoomMembers('r1').sort()).toStrictEqual(['c1', 'c2']);
  });

  it('getConnectionRooms() returns all rooms for a connection', () => {
    const rm = new RoomManager();
    rm.join('c1', 'r1');
    rm.join('c1', 'r2');
    expect(rm.getConnectionRooms('c1').sort()).toStrictEqual(['r1', 'r2']);
  });

  it('roomIds returns active room IDs', () => {
    const rm = new RoomManager();
    rm.join('c1', 'r1');
    rm.join('c2', 'r2');
    expect(rm.roomIds.sort()).toStrictEqual(['r1', 'r2']);
  });
});

// ─── WebSocketServer ──────────────────────────────────────────────────────────

describe('WebSocketServer', () => {
  it('register() creates and tracks connection', () => {
    const server = new WebSocketServer();
    server.register(makeAdapter('id-1'));
    expect(server.connectionCount).toBe(1);
    expect(server.getConnection('id-1')).toBeDefined();
  });

  it('disconnect() removes and closes connection', () => {
    const server = new WebSocketServer();
    const adapter = makeAdapter('id-2');
    server.register(adapter);
    server.disconnect('id-2');
    expect(server.connectionCount).toBe(0);
    expect(adapter.closed).toBe(true);
  });

  it('sendTo() sends message to specific connection', () => {
    const server = new WebSocketServer();
    const adapter = makeAdapter('id-3');
    server.register(adapter);
    server.sendTo('id-3', makeMsg('ping'));
    expect(adapter.sent).toHaveLength(1);
  });

  it('broadcast() sends to all connections', () => {
    const server = new WebSocketServer();
    const a1 = makeAdapter('a1');
    const a2 = makeAdapter('a2');
    server.register(a1);
    server.register(a2);
    server.broadcast(makeMsg('news'));
    expect(a1.sent).toHaveLength(1);
    expect(a2.sent).toHaveLength(1);
  });

  it('broadcast() respects excludeConnectionId', () => {
    const server = new WebSocketServer();
    const a1 = makeAdapter('a1');
    const a2 = makeAdapter('a2');
    server.register(a1);
    server.register(a2);
    server.broadcast(makeMsg('news'), { excludeConnectionId: 'a1' });
    expect(a1.sent).toHaveLength(0);
    expect(a2.sent).toHaveLength(1);
  });

  it('broadcast() with roomId only sends to room members', () => {
    const server = new WebSocketServer();
    const a1 = makeAdapter('a1');
    const a2 = makeAdapter('a2');
    const a3 = makeAdapter('a3');
    server.register(a1);
    server.register(a2);
    server.register(a3);
    server.joinRoom('a1', 'lobby');
    server.joinRoom('a2', 'lobby');
    server.broadcast(makeMsg('room-msg'), { roomId: 'lobby' });
    expect(a1.sent).toHaveLength(1);
    expect(a2.sent).toHaveLength(1);
    expect(a3.sent).toHaveLength(0);
  });

  it('authenticate() delegates to connection', () => {
    const server = new WebSocketServer({ authenticator: allowAll });
    server.register(makeAdapter('id-auth'));
    const result = server.authenticate('id-auth', 'mytoken');
    expect(result.authenticated).toBe(true);
  });

  it('authenticate() returns failure for missing connection', () => {
    const server = new WebSocketServer();
    const result = server.authenticate('no-such-id', 'tok');
    expect(result.authenticated).toBe(false);
  });

  it('onDisconnect() callback is invoked on disconnect', () => {
    const server = new WebSocketServer();
    const cb = vi.fn();
    server.onDisconnect(cb);
    server.register(makeAdapter('disc-1'));
    server.disconnect('disc-1');
    expect(cb).toHaveBeenCalledWith('disc-1');
  });

  it('disconnect() removes connection from rooms', () => {
    const server = new WebSocketServer();
    server.register(makeAdapter('rm-1'));
    server.joinRoom('rm-1', 'chat');
    server.disconnect('rm-1');
    expect(server.roomManager.getRoomMembers('chat')).toHaveLength(0);
  });

  it('activeConnections returns all wrapped connections', () => {
    const server = new WebSocketServer();
    server.register(makeAdapter('x1'));
    server.register(makeAdapter('x2'));
    expect(server.activeConnections).toHaveLength(2);
  });
});

// ─── ReconnectionHandler ──────────────────────────────────────────────────────

describe('ReconnectionHandler', () => {
  it('fixed strategy returns same delay always', () => {
    const h = new ReconnectionHandler({ strategy: 'fixed', maxAttempts: 5, baseDelayMs: 1000 });
    expect(h.getNextDelay(1)).toBe(1000);
    expect(h.getNextDelay(3)).toBe(1000);
  });

  it('linear strategy scales delay by attempt', () => {
    const h = new ReconnectionHandler({ strategy: 'linear', maxAttempts: 5, baseDelayMs: 500 });
    expect(h.getNextDelay(1)).toBe(500);
    expect(h.getNextDelay(3)).toBe(1500);
  });

  it('exponential strategy doubles each attempt', () => {
    const h = new ReconnectionHandler({
      strategy: 'exponential',
      maxAttempts: 5,
      baseDelayMs: 100,
    });
    expect(h.getNextDelay(1)).toBe(100);
    expect(h.getNextDelay(2)).toBe(200);
    expect(h.getNextDelay(3)).toBe(400);
  });

  it('exponential strategy caps at maxDelayMs', () => {
    const h = new ReconnectionHandler({
      strategy: 'exponential',
      maxAttempts: 10,
      baseDelayMs: 1000,
      maxDelayMs: 3000,
    });
    expect(h.getNextDelay(5)).toBe(3000);
  });

  it('shouldRetry returns false at maxAttempts', () => {
    const h = new ReconnectionHandler({ strategy: 'fixed', maxAttempts: 3, baseDelayMs: 100 });
    expect(h.shouldRetry(0)).toBe(true);
    expect(h.shouldRetry(2)).toBe(true);
    expect(h.shouldRetry(3)).toBe(false);
  });

  it('shouldRetry always true when maxAttempts is 0', () => {
    const h = new ReconnectionHandler({ strategy: 'fixed', maxAttempts: 0, baseDelayMs: 100 });
    expect(h.shouldRetry(9999)).toBe(true);
  });

  it('schedule() increments attempt counter', () => {
    const h = new ReconnectionHandler({ strategy: 'fixed', maxAttempts: 5, baseDelayMs: 200 });
    expect(h.attempts).toBe(0);
    h.schedule();
    expect(h.attempts).toBe(1);
    h.schedule();
    expect(h.attempts).toBe(2);
  });

  it('canRetry reflects internal attempt count', () => {
    const h = new ReconnectionHandler({ strategy: 'fixed', maxAttempts: 2, baseDelayMs: 100 });
    h.schedule();
    h.schedule();
    expect(h.canRetry).toBe(false);
  });

  it('reset() restores attempt counter', () => {
    const h = new ReconnectionHandler({ strategy: 'fixed', maxAttempts: 3, baseDelayMs: 100 });
    h.schedule();
    h.schedule();
    h.reset();
    expect(h.attempts).toBe(0);
    expect(h.canRetry).toBe(true);
  });
});
