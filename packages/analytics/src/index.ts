// Types
export type {
  EventProperties,
  AnalyticsEvent,
  AnalyticsUser,
  PageView,
  AnalyticsProvider,
  TrackerResult,
  CustomDimension,
  FunnelStep,
  FunnelResult,
} from './types.js';

// Core
export { AnalyticsTracker } from './AnalyticsTracker.js';
export { InMemoryProvider } from './InMemoryProvider.js';

// Providers
export { SegmentProvider } from './providers/SegmentProvider.js';
export { MixpanelProvider } from './providers/MixpanelProvider.js';
export { GoogleAnalytics4Provider } from './providers/GoogleAnalytics4Provider.js';

// Custom dimensions
export { CustomDimensionRegistry } from './CustomDimensionRegistry.js';

// Funnel tracking
export { FunnelTracker } from './FunnelTracker.js';
