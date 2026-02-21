/**
 * Tag-based cache invalidation registry.
 *
 * Maintains a bi-directional mapping between cache keys and named tags.
 * When a tag is removed, the registry returns all associated keys so the
 * caller can delete them from the actual cache store.
 *
 * @example
 * ```typescript
 * const tags = new CacheTagRegistry();
 *
 * tags.tag('user:1', ['users', 'premium']);
 * tags.tag('user:2', ['users']);
 *
 * const keysToEvict = tags.removeTag('users'); // ['user:1', 'user:2']
 * for (const key of keysToEvict) {
 *   await cache.delete(key);
 * }
 * ```
 */
export class CacheTagRegistry {
  private readonly tagToKeys = new Map<string, Set<string>>();
  private readonly keyToTags = new Map<string, Set<string>>();

  /** Associate one or more tags with a cache key. */
  tag(key: string, tags: readonly string[]): void {
    for (const t of tags) {
      this.addToTagIndex(key, t);
    }
    this.addToKeyIndex(key, tags);
  }

  /** Return all keys currently associated with `tag`. */
  getKeysByTag(tag: string): readonly string[] {
    const keys = this.tagToKeys.get(tag);
    return keys !== undefined ? Array.from(keys) : [];
  }

  /** Return all tags currently associated with `key`. */
  getTagsByKey(key: string): readonly string[] {
    const tags = this.keyToTags.get(key);
    return tags !== undefined ? Array.from(tags) : [];
  }

  /**
   * Remove a key from all tag associations.
   * Call when the cache entry is evicted or explicitly deleted.
   */
  removeKey(key: string): void {
    const tags = this.keyToTags.get(key);
    if (tags !== undefined) {
      for (const t of tags) {
        this.tagToKeys.get(t)?.delete(key);
      }
    }
    this.keyToTags.delete(key);
  }

  /**
   * Remove a tag and return all keys that were associated with it.
   * Use the returned key list to delete entries from the actual cache.
   */
  removeTag(tag: string): readonly string[] {
    const keys = this.tagToKeys.get(tag);
    if (keys === undefined) return [];
    for (const key of keys) {
      this.keyToTags.get(key)?.delete(tag);
    }
    this.tagToKeys.delete(tag);
    return Array.from(keys);
  }

  clear(): void {
    this.tagToKeys.clear();
    this.keyToTags.clear();
  }

  tagCount(): number {
    return this.tagToKeys.size;
  }

  keyCount(): number {
    return this.keyToTags.size;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private addToTagIndex(key: string, tag: string): void {
    const keys = this.tagToKeys.get(tag) ?? new Set<string>();
    keys.add(key);
    this.tagToKeys.set(tag, keys);
  }

  private addToKeyIndex(key: string, tags: readonly string[]): void {
    const existingTags = this.keyToTags.get(key) ?? new Set<string>();
    for (const t of tags) {
      existingTags.add(t);
    }
    this.keyToTags.set(key, existingTags);
  }
}
