import type { AnalyticsProvider, AnalyticsEvent, AnalyticsUser, PageView } from '../types.js';

/** Injectable HTTP sender — defaults to a no-op, replace in production. */
export type Sender = (payload: unknown) => Promise<void>;

const noopSender: Sender = async () => Promise.resolve();

/** Configuration for {@link SegmentProvider}. */
export interface SegmentConfig {
  readonly writeKey: string;
  /** Override the HTTP sender (useful for testing without real network calls). */
  readonly sender?: Sender;
}

/**
 * Analytics provider adapter for the **Segment** platform.
 *
 * Formats payloads according to the Segment HTTP Tracking API v1 spec
 * and delegates actual delivery to the injected `sender`.
 */
export class SegmentProvider implements AnalyticsProvider {
  readonly name = 'segment';
  private readonly writeKey: string;
  private readonly sender: Sender;

  constructor(config: SegmentConfig) {
    this.writeKey = config.writeKey;
    this.sender = config.sender ?? noopSender;
  }

  async track(event: AnalyticsEvent): Promise<void> {
    await this.sender({
      type: 'track',
      writeKey: this.writeKey,
      event: event.name,
      userId: event.userId,
      anonymousId: event.anonymousId,
      properties: event.properties ?? {},
      timestamp: (event.timestamp ?? new Date()).toISOString(),
    });
  }

  async identify(user: AnalyticsUser): Promise<void> {
    await this.sender({
      type: 'identify',
      writeKey: this.writeKey,
      userId: user.userId,
      traits: user.traits ?? {},
    });
  }

  async page(view: PageView): Promise<void> {
    await this.sender({
      type: 'page',
      writeKey: this.writeKey,
      name: view.name,
      userId: view.userId,
      properties: { ...view.properties, url: view.url },
    });
  }
}
