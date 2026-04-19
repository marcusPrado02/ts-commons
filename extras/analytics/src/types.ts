/**
 * Arbitrary key-value properties attached to events, users, and pages.
 */
export type EventProperties = Record<string, unknown>;

// ─── Core event types ─────────────────────────────────────────────────────────

/** An analytics event dispatched to one or more providers. */
export interface AnalyticsEvent {
  /** Human-readable event name (e.g. `"Button Clicked"`). */
  readonly name: string;
  /** Optional arbitrary properties. */
  readonly properties?: EventProperties;
  /** Identified user ID (omit for anonymous events). */
  readonly userId?: string;
  /** Anonymous session identifier. */
  readonly anonymousId?: string;
  /** Event timestamp — defaults to `new Date()` when not provided. */
  readonly timestamp?: Date;
}

/** An identified user with optional trait data. */
export interface AnalyticsUser {
  readonly userId: string;
  readonly traits?: EventProperties;
}

/** A page-view event. */
export interface PageView {
  readonly name?: string;
  readonly url?: string;
  readonly properties?: EventProperties;
  readonly userId?: string;
}

// ─── Provider interface ───────────────────────────────────────────────────────

/** Contract that every analytics provider must satisfy. */
export interface AnalyticsProvider {
  /** Unique provider name used in reports (e.g. `"segment"`). */
  readonly name: string;
  track(event: AnalyticsEvent): Promise<void>;
  identify(user: AnalyticsUser): Promise<void>;
  page(view: PageView): Promise<void>;
}

/** Result returned by {@link AnalyticsTracker.track}. */
export interface TrackerResult {
  readonly event: AnalyticsEvent;
  readonly successCount: number;
  readonly failureCount: number;
  readonly errors: Error[];
}

// ─── Custom dimensions ────────────────────────────────────────────────────────

/** A registered custom dimension that can be applied to events. */
export interface CustomDimension {
  /** Property key used in {@link EventProperties}. */
  readonly key: string;
  /** Human-readable label. */
  readonly label: string;
  /** Optional description. */
  readonly description?: string;
}

// ─── Funnel tracking ──────────────────────────────────────────────────────────

/** A single step within a funnel; `completedAt` is undefined until the step is recorded. */
export interface FunnelStep {
  readonly name: string;
  readonly completedAt?: Date;
}

/** Result of inspecting a user's progress through a named funnel. */
export interface FunnelResult {
  readonly funnelName: string;
  readonly steps: FunnelStep[];
  readonly completedSteps: number;
  readonly totalSteps: number;
  /** `completedSteps / totalSteps`, or `1` when the funnel has no steps. */
  readonly conversionRate: number;
  readonly completed: boolean;
}
