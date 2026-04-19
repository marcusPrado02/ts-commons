import type { WatchConfig, WatchEvent, WatchPattern, WatchMode, DebounceEntry } from './WatchTypes';

function matchesGlob(path: string, glob: string): boolean {
  // Escape regex special chars (excluding * which we handle below)
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    // /**/ and /**  →  allow zero or more path segments
    .replace(/\/\*\*\//g, '(/.*)?/')
    .replace(/\/\*\*$/g, '(/.*)?')
    .replace(/^\*\*\//g, '(.*/)?')
    // remaining * → single segment (no slash)
    .replace(/\*/g, '[^/]*');
  return new RegExp(`^${escaped}$`).test(path);
}

function isIgnored(path: string, ignored: readonly string[]): boolean {
  return ignored.some((ig) => path.includes(ig));
}

function matchingPatterns(path: string, patterns: readonly WatchPattern[]): WatchPattern[] {
  return patterns.filter((p) => matchesGlob(path, p.glob));
}

export class WatchManager {
  private readonly debounceMap = new Map<string, DebounceEntry>();
  private readonly eventLog: WatchEvent[] = [];

  constructor(private readonly config: WatchConfig) {}

  /** Record an incoming file-system event; returns the matching patterns. */
  receive(event: WatchEvent): readonly WatchPattern[] {
    if (isIgnored(event.path, this.config.ignored)) return [];
    this.eventLog.push(event);
    const matched = matchingPatterns(event.path, this.config.patterns);
    for (const pattern of matched) {
      this.scheduleDebounce(event, pattern);
    }
    return matched;
  }

  private scheduleDebounce(event: WatchEvent, pattern: WatchPattern): void {
    const key = `${pattern.glob}:${event.path}`;
    const existing = this.debounceMap.get(key);
    if (existing !== undefined) {
      existing.events.push(event);
      existing.scheduledAt = Date.now() + pattern.debounceMs;
    } else {
      this.debounceMap.set(key, {
        pattern,
        events: [event],
        scheduledAt: Date.now() + pattern.debounceMs,
      });
    }
  }

  /** Flush all debounce entries whose scheduled time has elapsed. */
  flush(now: number): readonly DebounceEntry[] {
    const ready: DebounceEntry[] = [];
    for (const [key, entry] of this.debounceMap) {
      if (entry.scheduledAt <= now) {
        ready.push(entry);
        this.debounceMap.delete(key);
      }
    }
    return ready;
  }

  /** All events received so far for a given mode. */
  eventsForMode(mode: WatchMode): readonly WatchEvent[] {
    const matched = new Set<string>();
    for (const pattern of this.config.patterns) {
      if (pattern.mode === mode || pattern.mode === 'both') {
        for (const event of this.eventLog) {
          if (matchesGlob(event.path, pattern.glob)) {
            matched.add(event.path);
          }
        }
      }
    }
    return this.eventLog.filter((e) => matched.has(e.path));
  }

  /** How many events have been received. */
  eventCount(): number {
    return this.eventLog.length;
  }

  /** How many debounce entries are still pending. */
  pendingCount(): number {
    return this.debounceMap.size;
  }

  /** Clear all state. */
  reset(): void {
    this.debounceMap.clear();
    this.eventLog.length = 0;
  }

  rootDir(): string {
    return this.config.rootDir;
  }
}
