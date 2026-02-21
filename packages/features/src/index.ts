// Types
export type {
  VariantValue,
  FeatureContext,
  RuleOperator,
  TargetingAttribute,
  TargetingRule,
  RolloutRule,
  ABTestVariant,
  FeatureFlag,
  EvaluationReason,
  EvaluationResult,
} from './FeatureTypes.js';

// Port
export type { FeatureProviderPort } from './FeaturePort.js';

// Errors
export {
  FeatureFlagNotFoundError,
  FeatureProviderError,
  TargetingRuleError,
} from './FeatureErrors.js';

// Engine utilities (exported for extensibility)
export { evaluateTargeting, evaluateRollout } from './TargetingEngine.js';
export { assignVariant } from './ABTestManager.js';

// Core service
export { FeatureService } from './FeatureService.js';

// In-memory implementation
export { InMemoryFeatureProvider } from './InMemoryFeatureProvider.js';
