# @marcusprado02/websocket

WebSocket server abstraction with room management, reconnection handling, and authentication. Adapts to Socket.io or any custom `SocketAdapter`.

## Installation

```bash
pnpm add @marcusprado02/websocket
```

## Quick Start

```typescript
import { WebSocketServer, RoomManager } from '@marcusprado02/websocket';

const server = new WebSocketServer({
  adapter: socketIoAdapter,
  authenticate: async (token) => verifyJwt(token),
});

server.onMessage('order:subscribe', async (conn, msg) => {
  await roomManager.join(conn.id, `order:${msg.orderId}`);
});

server.onMessage('order:update', async (conn, msg) => {
  await server.broadcast({ room: `order:${msg.orderId}`, event: 'order:updated', data: msg });
});

server.listen(3001);
```

## Room Management

```typescript
import { RoomManager } from '@marcusprado02/websocket';

const rooms = new RoomManager();
await rooms.join(connectionId, 'order:123');
await rooms.broadcast('order:123', { event: 'status-changed', data: { status: 'shipped' } });
await rooms.leave(connectionId, 'order:123');
```

## Reconnection

```typescript
import { ReconnectionHandler } from '@marcusprado02/websocket';

const reconnect = new ReconnectionHandler({
  strategy: 'exponential',
  initialDelayMs: 1000,
  maxDelayMs: 30_000,
  maxAttempts: 10,
});
```

## See Also

- [`@marcusprado02/messaging`](../messaging) — broker-backed event publishing
- [`@marcusprado02/web`](../web) — HTTP adapter base types
