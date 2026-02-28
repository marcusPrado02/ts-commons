/**
 * Unique identifier for a WebSocket connection.
 */
export type ConnectionId = string;

/**
 * Identifier for a WebSocket room / channel.
 */
export type RoomId = string;

/**
 * A typed message envelope exchanged over WebSocket.
 */
export interface WebSocketMessage<T = unknown> {
  readonly type: string;
  readonly payload: T;
  readonly connectionId: ConnectionId;
  readonly timestamp: number;
}

/**
 * Result of authenticating a WebSocket connection.
 */
export interface AuthResult {
  readonly authenticated: boolean;
  readonly userId?: string;
  readonly roles?: string[];
  readonly reason?: string;
}

/**
 * Lifecycle state of a WebSocket connection.
 */
export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

/**
 * Backoff strategies for reconnection.
 */
export type ReconnectionStrategy = 'fixed' | 'exponential' | 'linear';

/**
 * Configuration for the {@link ReconnectionHandler}.
 */
export interface ReconnectionConfig {
  readonly strategy: ReconnectionStrategy;
  /** Maximum number of reconnection attempts (0 = unlimited). */
  readonly maxAttempts: number;
  /** Base delay in milliseconds. */
  readonly baseDelayMs: number;
  /** Maximum capped delay (only relevant for exponential). */
  readonly maxDelayMs?: number;
}

/**
 * Broadcast targeting options.
 */
export interface BroadcastTarget {
  readonly roomId?: RoomId;
  readonly excludeConnectionId?: ConnectionId;
}

/**
 * Injectable transport adapter that abstracts the raw socket.
 * Implement this interface (or use the provided test double) to hook in different transports.
 */
export interface SocketAdapter {
  readonly id: ConnectionId;
  send(data: string): void;
  close(): void;
}

/**
 * Handler function that validates a bearer token and returns an {@link AuthResult}.
 */
export type AuthenticatorFn = (token: string) => AuthResult;

/**
 * Handler signature for connection-level events.
 */
export type MessageHandler<T = unknown> = (message: WebSocketMessage<T>) => void;

/**
 * Handler signature for disconnect events.
 */
export type DisconnectHandler = (connectionId: ConnectionId) => void;
