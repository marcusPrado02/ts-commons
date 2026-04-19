import type { AnalyticsProvider, AnalyticsEvent, AnalyticsUser, PageView } from '../types.js';
import type { Sender } from './SegmentProvider.js';

const noopSender: Sender = async () => Promise.resolve();

/** Configuration for {@link MixpanelProvider}. */
export interface MixpanelConfig {
  readonly token: string;
  /** Override the HTTP sender (useful for testing without real network calls). */
  readonly sender?: Sender;
}

/**
 * Analytics provider adapter for the **Mixpanel** platform.
 *
 * Formats payloads according to the Mixpanel HTTP API spec
 * and delegates actual delivery to the injected `sender`.
 */
export class MixpanelProvider implements AnalyticsProvider {
  readonly name = 'mixpanel';
  private readonly token: string;
  private readonly sender: Sender;

  constructor(config: MixpanelConfig) {
    this.token = config.token;
    this.sender = config.sender ?? noopSender;
  }

  async track(event: AnalyticsEvent): Promise<void> {
    await this.sender({
      event: event.name,
      properties: {
        token: this.token,
        distinct_id: event.userId ?? event.anonymousId,
        time: (event.timestamp ?? new Date()).getTime(),
        ...event.properties,
      },
    });
  }

  async identify(user: AnalyticsUser): Promise<void> {
    await this.sender({
      $token: this.token,
      $distinct_id: user.userId,
      $set: user.traits ?? {},
    });
  }

  async page(view: PageView): Promise<void> {
    await this.sender({
      event: '$mp_web_page_view',
      properties: {
        token: this.token,
        distinct_id: view.userId,
        current_page_title: view.name,
        current_url: view.url,
        ...view.properties,
      },
    });
  }
}
