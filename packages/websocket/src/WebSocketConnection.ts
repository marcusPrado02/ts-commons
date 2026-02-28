import type {
  ConnectionId,
  ConnectionState,
  AuthResult,
  AuthenticatorFn,
  WebSocketMessage,
  MessageHandler,
  SocketAdapter,
} from './types.js';

interface ConnectionOptions {
  readonly authenticator?: AuthenticatorFn;
}

/**
 * Represents a single WebSocket connection.
 *
 * Wraps a {@link SocketAdapter} transport and adds typed messaging,
 * authentication, and state management.
 */
export class WebSocketConnection {
  private readonly adapter: SocketAdapter;
  private readonly authenticator: AuthenticatorFn | undefined;
  private readonly handlers = new Map<string, Set<MessageHandler>>();
  private connectionState: ConnectionState = 'connected';
  private authResult: AuthResult | undefined;

  constructor(adapter: SocketAdapter, options?: ConnectionOptions) {
    this.adapter = adapter;
    this.authenticator = options?.authenticator;
  }

  /** Unique identifier of this connection, delegated to the adapter. */
  get id(): ConnectionId {
    return this.adapter.id;
  }

  /** Current lifecycle state of the connection. */
  get state(): ConnectionState {
    return this.connectionState;
  }

  /** Whether the connection has been successfully authenticated. */
  get isAuthenticated(): boolean {
    return this.authResult?.authenticated === true;
  }

  /** The authenticated user's ID, if applicable. */
  get userId(): string | undefined {
    return this.authResult?.userId;
  }

  /** Roles granted to the authenticated user. */
  get roles(): string[] {
    return this.authResult?.roles ?? [];
  }

  /**
   * Send a typed message through this connection's adapter.
   * No-ops if the connection is already disconnected.
   */
  send(message: WebSocketMessage): void {
    if (this.connectionState !== 'connected') return;
    this.adapter.send(JSON.stringify(message));
  }

  /**
   * Deliver a raw JSON string as if it were received from the remote peer.
   * Parses the envelope and dispatches to registered handlers.
   */
  receive(data: string): void {
    const message = parseMessage(data);
    if (message === null) return;
    const handlers = this.handlers.get(message.type);
    if (handlers === undefined) return;
    for (const handler of handlers) handler(message);
  }

  /**
   * Attempt to authenticate this connection using the injected {@link AuthenticatorFn}.
   * Stores the result so callers can inspect {@link isAuthenticated} / {@link userId}.
   */
  authenticate(token: string): AuthResult {
    if (this.authenticator === undefined) {
      const result: AuthResult = { authenticated: false, reason: 'No authenticator configured' };
      this.authResult = result;
      return result;
    }
    const result = this.authenticator(token);
    this.authResult = result;
    return result;
  }

  /**
   * Register a handler for a specific message type.
   * Multiple handlers for the same type are all invoked.
   */
  on(type: string, handler: MessageHandler): void {
    let set = this.handlers.get(type);
    if (set === undefined) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler);
  }

  /** Remove a previously registered message handler. */
  off(type: string, handler: MessageHandler): void {
    this.handlers.get(type)?.delete(handler);
  }

  /**
   * Disconnect this connection.
   * Marks state as disconnected and closes the underlying adapter.
   */
  disconnect(): void {
    if (this.connectionState === 'disconnected') return;
    this.connectionState = 'disconnected';
    this.adapter.close();
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function parseMessage(data: string): WebSocketMessage | null {
  try {
    const parsed: unknown = JSON.parse(data);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'type' in parsed &&
      typeof (parsed as Record<string, unknown>)['type'] === 'string'
    ) {
      return parsed as WebSocketMessage;
    }
    return null;
  } catch {
    return null;
  }
}
