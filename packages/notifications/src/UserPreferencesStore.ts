import type { NotificationChannel } from './NotificationTypes';

/**
 * In-memory store that tracks per-user notification channel opt-out preferences.
 *
 * @example
 * ```ts
 * const store = new UserPreferencesStore();
 * store.optOut('user-1', 'sms');
 * store.isOptedOut('user-1', 'sms'); // true
 * store.optIn('user-1', 'sms');
 * store.isOptedOut('user-1', 'sms'); // false
 * ```
 */
export class UserPreferencesStore {
  private readonly optedOut = new Map<string, Set<NotificationChannel>>();

  /** Mark a user as opted out of a specific channel. */
  optOut(userId: string, channel: NotificationChannel): void {
    const channels = this.optedOut.get(userId);
    if (channels === undefined) {
      this.optedOut.set(userId, new Set([channel]));
    } else {
      channels.add(channel);
    }
  }

  /** Remove an opt-out for a specific channel (re-subscribe). */
  optIn(userId: string, channel: NotificationChannel): void {
    this.optedOut.get(userId)?.delete(channel);
  }

  /** Return `true` if the user has opted out of the given channel. */
  isOptedOut(userId: string, channel: NotificationChannel): boolean {
    return this.optedOut.get(userId)?.has(channel) === true;
  }

  /** Return all channels the user has opted out of. */
  getOptedOutChannels(userId: string): readonly NotificationChannel[] {
    const channels = this.optedOut.get(userId);
    if (channels === undefined) return [];
    return [...channels];
  }

  /** Opt a user out of every channel at once. */
  optOutAll(userId: string, channels: readonly NotificationChannel[]): void {
    for (const ch of channels) this.optOut(userId, ch);
  }

  /** Remove all stored preferences. */
  clear(): void {
    this.optedOut.clear();
  }
}
