import type {
  AnalyticsProvider,
  AnalyticsEvent,
  AnalyticsUser,
  PageView,
  TrackerResult,
} from './types.js';

/**
 * Central analytics tracker that dispatches events to all registered
 * {@link AnalyticsProvider}s in parallel and aggregates results.
 *
 * @example
 * ```ts
 * const tracker = new AnalyticsTracker()
 *   .addProvider(new SegmentProvider({ writeKey: 'xxx' }))
 *   .addProvider(new MixpanelProvider({ token: 'yyy' }));
 *
 * const result = await tracker.track({ name: 'Page Viewed', userId: 'u1' });
 * ```
 */
export class AnalyticsTracker {
  private readonly providers: AnalyticsProvider[] = [];

  /** Register a provider — returns `this` for fluent chaining. */
  addProvider(provider: AnalyticsProvider): this {
    this.providers.push(provider);
    return this;
  }

  /** Number of registered providers. */
  providerCount(): number {
    return this.providers.length;
  }

  /**
   * Dispatch an event to all providers.
   * Individual provider failures are caught and included in {@link TrackerResult}.
   */
  async track(event: AnalyticsEvent): Promise<TrackerResult> {
    const errors: Error[] = [];
    let successCount = 0;

    const settled = await Promise.allSettled(this.providers.map((p) => p.track(event)));

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        successCount++;
      } else {
        errors.push(
          result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
        );
      }
    }

    return {
      event,
      successCount,
      failureCount: errors.length,
      errors,
    };
  }

  /**
   * Identify a user across all providers.
   * Errors are silently discarded — use {@link track} when result tracking is needed.
   */
  async identify(user: AnalyticsUser): Promise<void> {
    await Promise.allSettled(this.providers.map((p) => p.identify(user)));
  }

  /**
   * Record a page view across all providers.
   */
  async page(view: PageView): Promise<void> {
    await Promise.allSettled(this.providers.map((p) => p.page(view)));
  }
}
