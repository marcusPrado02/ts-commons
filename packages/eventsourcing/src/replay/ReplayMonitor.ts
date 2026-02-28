import type { ReplayProgress, ProgressCallback } from './types.js';

/**
 * Accumulates replay progress updates and exposes summary statistics.
 *
 * Use as the `onProgress` callback with {@link EventReplayer} to track
 * the replay in real-time.
 *
 * @example
 * ```ts
 * const monitor = new ReplayMonitor('user-123');
 * await replayer.replay('user-123', applyFn, {}, monitor.callback);
 * console.log(monitor.summary);
 * ```
 */
export class ReplayMonitor {
  private readonly progressHandlers = new Set<ProgressCallback>();
  private latestProgress: ReplayProgress | null = null;
  readonly streamId: string;

  constructor(streamId: string) {
    this.streamId = streamId;
  }

  /**
   * A pre-bound progress callback that can be passed directly to
   * {@link EventReplayer.replay}.
   */
  readonly callback: ProgressCallback = (progress: ReplayProgress): void => {
    this.latestProgress = progress;
    for (const handler of this.progressHandlers) handler(progress);
  };

  /**
   * Register a listener that will be called on every progress update.
   * Returns an unsubscribe function.
   */
  onProgress(handler: ProgressCallback): () => void {
    this.progressHandlers.add(handler);
    return (): void => {
      this.progressHandlers.delete(handler);
    };
  }

  /** Most recent progress snapshot, or `null` if replay has not started. */
  get latest(): ReplayProgress | null {
    return this.latestProgress;
  }

  /** Shorthand: total events processed so far. */
  get processed(): number {
    return this.latestProgress?.eventsProcessed ?? 0;
  }

  /** Shorthand: current stream version being processed. */
  get currentVersion(): number {
    return this.latestProgress?.currentVersion ?? -1;
  }

  /** Reset accumulated state — useful between multiple replay runs. */
  reset(): void {
    this.latestProgress = null;
  }
}
