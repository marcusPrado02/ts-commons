import type { AnalyticsProvider, AnalyticsEvent, AnalyticsUser, PageView } from '../types.js';
import type { Sender } from './SegmentProvider.js';

const noopSender: Sender = async () => Promise.resolve();

/** Configuration for {@link GoogleAnalytics4Provider}. */
export interface GA4Config {
  /** GA4 Measurement ID (e.g. `"G-XXXXXXXXXX"`). */
  readonly measurementId: string;
  /** GA4 API secret for the Measurement Protocol. */
  readonly apiSecret: string;
  /** Override the HTTP sender (useful for testing without real network calls). */
  readonly sender?: Sender;
}

/**
 * Analytics provider adapter for **Google Analytics 4** (Measurement Protocol).
 *
 * Formats payloads according to the GA4 Measurement Protocol spec
 * and delegates actual delivery to the injected `sender`.
 */
export class GoogleAnalytics4Provider implements AnalyticsProvider {
  readonly name = 'ga4';
  private readonly measurementId: string;
  private readonly apiSecret: string;
  private readonly sender: Sender;

  constructor(config: GA4Config) {
    this.measurementId = config.measurementId;
    this.apiSecret = config.apiSecret;
    this.sender = config.sender ?? noopSender;
  }

  async track(event: AnalyticsEvent): Promise<void> {
    await this.sender({
      measurement_id: this.measurementId,
      api_secret: this.apiSecret,
      client_id: event.userId ?? event.anonymousId ?? 'anonymous',
      events: [
        {
          name: this.sanitizeEventName(event.name),
          params: {
            ...event.properties,
            timestamp_micros: (event.timestamp ?? new Date()).getTime() * 1000,
          },
        },
      ],
    });
  }

  async identify(user: AnalyticsUser): Promise<void> {
    // GA4 uses user properties — modelled as a set_user_property event
    await this.sender({
      measurement_id: this.measurementId,
      api_secret: this.apiSecret,
      client_id: user.userId,
      user_properties: user.traits ?? {},
    });
  }

  async page(view: PageView): Promise<void> {
    await this.sender({
      measurement_id: this.measurementId,
      api_secret: this.apiSecret,
      client_id: view.userId ?? 'anonymous',
      events: [
        {
          name: 'page_view',
          params: {
            page_title: view.name,
            page_location: view.url,
            ...view.properties,
          },
        },
      ],
    });
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * GA4 event names must be alphanumeric + underscores.
   * Converts spaces and hyphens to underscores and lowercases the result.
   */
  private sanitizeEventName(name: string): string {
    return name.toLowerCase().replace(/[\s-]+/g, '_');
  }
}
