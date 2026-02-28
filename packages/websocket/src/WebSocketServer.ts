import type {
  ConnectionId,
  WebSocketMessage,
  AuthResult,
  AuthenticatorFn,
  BroadcastTarget,
  SocketAdapter,
  DisconnectHandler,
} from './types.js';
import { WebSocketConnection } from './WebSocketConnection.js';
import { RoomManager } from './RoomManager.js';

interface ServerOptions {
  readonly authenticator?: AuthenticatorFn;
}

/**
 * In-process WebSocket server that manages connections, rooms, and broadcasting.
 *
 * The transport is decoupled via {@link SocketAdapter}, so the server can be
 * tested with lightweight fakes instead of real OS sockets.
 *
 * @example
 * ```ts
 * const server = new WebSocketServer({ authenticator: verifyJwt });
 * const conn = server.register(adapter);
 * server.broadcast({ type: 'welcome', payload: null, connectionId: '', timestamp: Date.now() });
 * ```
 */
export class WebSocketServer {
  private readonly options: ServerOptions;
  private readonly connections = new Map<ConnectionId, WebSocketConnection>();
  private readonly rooms: RoomManager;
  private readonly disconnectHandlers = new Set<DisconnectHandler>();

  constructor(options: ServerOptions = {}) {
    this.options = options;
    this.rooms = new RoomManager();
  }

  /**
   * Register a new socket adapter as a managed connection and return the
   * {@link WebSocketConnection} wrapper.
   */
  register(adapter: SocketAdapter): WebSocketConnection {
    const conn = new WebSocketConnection(adapter, { authenticator: this.options.authenticator });
    this.connections.set(conn.id, conn);
    return conn;
  }

  /**
   * Disconnect and remove a connection by its ID.
   * Removes the connection from all rooms and invokes disconnect handlers.
   */
  disconnect(connectionId: ConnectionId): void {
    const conn = this.connections.get(connectionId);
    if (conn === undefined) return;
    conn.disconnect();
    this.connections.delete(connectionId);
    this.rooms.leaveAll(connectionId);
    for (const handler of this.disconnectHandlers) handler(connectionId);
  }

  /**
   * Send a message to a specific connection.
   * No-op if the connection does not exist.
   */
  sendTo(connectionId: ConnectionId, message: WebSocketMessage): void {
    this.connections.get(connectionId)?.send(message);
  }

  /**
   * Broadcast a message to all connections, or to a specific room if
   * `target.roomId` is provided. An optional `excludeConnectionId` prevents
   * echo back to the sender.
   */
  broadcast(message: WebSocketMessage, target: BroadcastTarget = {}): void {
    const recipients =
      target.roomId !== undefined
        ? buildRoomRecipients(
            this.rooms.getRoomMembers(target.roomId),
            this.connections,
            target.excludeConnectionId,
          )
        : buildAllRecipients(this.connections, target.excludeConnectionId);

    for (const conn of recipients) conn.send(message);
  }

  /**
   * Authenticate an existing connection using the server's {@link AuthenticatorFn}.
   */
  authenticate(connectionId: ConnectionId, token: string): AuthResult {
    const conn = this.connections.get(connectionId);
    if (conn === undefined) {
      return { authenticated: false, reason: 'Connection not found' };
    }
    return conn.authenticate(token);
  }

  /** Add a connection to a room. */
  joinRoom(connectionId: ConnectionId, roomId: string): void {
    this.rooms.join(connectionId, roomId);
  }

  /** Remove a connection from a room. */
  leaveRoom(connectionId: ConnectionId, roomId: string): void {
    this.rooms.leave(connectionId, roomId);
  }

  /** Retrieve a connection by its ID. */
  getConnection(connectionId: ConnectionId): WebSocketConnection | undefined {
    return this.connections.get(connectionId);
  }

  /** Register a handler invoked whenever a connection is disconnected. */
  onDisconnect(handler: DisconnectHandler): void {
    this.disconnectHandlers.add(handler);
  }

  /** Number of currently managed connections. */
  get connectionCount(): number {
    return this.connections.size;
  }

  /** All active connections. */
  get activeConnections(): WebSocketConnection[] {
    return [...this.connections.values()];
  }

  /** Access the underlying room manager. */
  get roomManager(): RoomManager {
    return this.rooms;
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function buildAllRecipients(
  connections: Map<ConnectionId, WebSocketConnection>,
  excludeId: ConnectionId | undefined,
): WebSocketConnection[] {
  const result: WebSocketConnection[] = [];
  for (const [id, conn] of connections) {
    if (id !== excludeId) result.push(conn);
  }
  return result;
}

function buildRoomRecipients(
  members: ConnectionId[],
  connections: Map<ConnectionId, WebSocketConnection>,
  excludeId: ConnectionId | undefined,
): WebSocketConnection[] {
  const result: WebSocketConnection[] = [];
  for (const id of members) {
    if (id === excludeId) continue;
    const conn = connections.get(id);
    if (conn !== undefined) result.push(conn);
  }
  return result;
}
