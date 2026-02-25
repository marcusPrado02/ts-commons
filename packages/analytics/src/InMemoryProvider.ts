import type { AnalyticsProvider, AnalyticsEvent, AnalyticsUser, PageView } from './types.js';

/**
 * In-memory {@link AnalyticsProvider} that records all calls.
 * Intended for use in tests.
 */
export class InMemoryProvider implements AnalyticsProvider {
  readonly name: string;

  private readonly tracked: AnalyticsEvent[] = [];
  private readonly identified: AnalyticsUser[] = [];
  private readonly pages: PageView[] = [];

  constructor(name = 'in-memory') {
    this.name = name;
  }

  async track(event: AnalyticsEvent): Promise<void> {
    await Promise.resolve();
    this.tracked.push(event);
  }

  async identify(user: AnalyticsUser): Promise<void> {
    await Promise.resolve();
    this.identified.push(user);
  }

  async page(view: PageView): Promise<void> {
    await Promise.resolve();
    this.pages.push(view);
  }

  /** All tracked events. */
  getTracked(): AnalyticsEvent[] {
    return [...this.tracked];
  }

  /** All identify calls. */
  getIdentified(): AnalyticsUser[] {
    return [...this.identified];
  }

  /** All page-view calls. */
  getPages(): PageView[] {
    return [...this.pages];
  }

  /** Reset all recorded calls. */
  clear(): void {
    this.tracked.length = 0;
    this.identified.length = 0;
    this.pages.length = 0;
  }
}
