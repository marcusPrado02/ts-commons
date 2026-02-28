import type { ConnectionId, RoomId } from './types.js';

/**
 * Manages room membership for WebSocket connections.
 *
 * A room is a named group of {@link ConnectionId}s.
 * Rooms are created on first join and automatically pruned when empty.
 */
export class RoomManager {
  /** roomId → set of connection IDs */
  private readonly rooms = new Map<RoomId, Set<ConnectionId>>();
  /** connectionId → set of room IDs */
  private readonly membership = new Map<ConnectionId, Set<RoomId>>();

  /**
   * Add a connection to a room.
   * If the room does not exist it is created automatically.
   */
  join(connectionId: ConnectionId, roomId: RoomId): void {
    addToSet(this.rooms, roomId, connectionId);
    addToSet(this.membership, connectionId, roomId);
  }

  /**
   * Remove a connection from a room.
   * If the room becomes empty it is deleted.
   */
  leave(connectionId: ConnectionId, roomId: RoomId): void {
    removeFromSet(this.rooms, roomId, connectionId);
    removeFromSet(this.membership, connectionId, roomId);
  }

  /**
   * Remove a connection from **all** rooms it is currently a member of.
   * Used when a connection disconnects.
   */
  leaveAll(connectionId: ConnectionId): void {
    const rooms = new Set(this.membership.get(connectionId) ?? []);
    for (const roomId of rooms) {
      this.leave(connectionId, roomId);
    }
  }

  /** Returns all connection IDs currently in a room (empty array if room absent). */
  getRoomMembers(roomId: RoomId): ConnectionId[] {
    return [...(this.rooms.get(roomId) ?? [])];
  }

  /** Returns all room IDs a connection is currently a member of. */
  getConnectionRooms(connectionId: ConnectionId): RoomId[] {
    return [...(this.membership.get(connectionId) ?? [])];
  }

  /** Returns the set of all active room IDs. */
  get roomIds(): RoomId[] {
    return [...this.rooms.keys()];
  }

  /** Returns the number of rooms currently tracked. */
  get roomCount(): number {
    return this.rooms.size;
  }

  /** Returns true if the connection is a member of the given room. */
  isMember(connectionId: ConnectionId, roomId: RoomId): boolean {
    return this.rooms.get(roomId)?.has(connectionId) === true;
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function addToSet<K, V>(map: Map<K, Set<V>>, key: K, value: V): void {
  let set = map.get(key);
  if (set === undefined) {
    set = new Set<V>();
    map.set(key, set);
  }
  set.add(value);
}

function removeFromSet<K, V>(map: Map<K, Set<V>>, key: K, value: V): void {
  const set = map.get(key);
  if (set === undefined) return;
  set.delete(value);
  if (set.size === 0) map.delete(key);
}
