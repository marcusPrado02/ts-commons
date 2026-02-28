import type { SseEvent } from './types.js';

/**
 * Formats {@link SseEvent} objects into the SSE wire protocol.
 *
 * The SSE format per spec (https://html.spec.whatwg.org/multipage/server-sent-events.html):
 * ```
 * id: <id>\n
 * event: <type>\n
 * data: <json>\n
 * retry: <ms>\n
 * \n
 * ```
 * Fields that are `undefined` are omitted.
 */
export class SseFormatter {
  /**
   * Serialise a single {@link SseEvent} to an SSE-formatted string.
   */
  format<T>(event: SseEvent<T>): string {
    const lines: string[] = [];

    if (event.id !== undefined) lines.push(`id: ${event.id}`);
    if (event.event !== undefined) lines.push(`event: ${event.event}`);
    lines.push(`data: ${JSON.stringify(event.data)}`);
    if (event.retry !== undefined) lines.push(`retry: ${event.retry}`);

    // SSE blocks are terminated by a blank line.
    return `${lines.join('\n')}\n\n`;
  }

  /**
   * Format a comment line — useful for keep-alive pings.
   * Comments are lines starting with `:`.
   */
  formatComment(comment: string): string {
    return `: ${comment}\n\n`;
  }

  /**
   * Parse a raw SSE-formatted string back into a partial event object.
   * Primarily useful for testing round-trips.
   * Returns `null` if the input cannot be parsed.
   */
  parse(raw: string): Partial<SseEvent<unknown>> | null {
    const result: Record<string, unknown> = {};
    const lines = raw.split('\n').filter((l) => l.trim() !== '');
    for (const line of lines) {
      if (line.startsWith(':')) continue; // comment
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const field = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      if (field === 'data') {
        result['data'] = parseJson(value);
      } else if (field === 'id' || field === 'event') {
        result[field] = value;
      } else if (field === 'retry') {
        const n = Number(value);
        if (!isNaN(n)) result['retry'] = n;
      }
    }
    return Object.keys(result).length > 0 ? (result as Partial<SseEvent<unknown>>) : null;
  }
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
