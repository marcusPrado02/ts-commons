import type {
  EvaluationResult,
  FeatureContext,
  FeatureFlag,
  VariantValue,
} from './FeatureTypes.js';

/**
 * Port interface that feature flag providers must implement.
 */
export interface FeatureProviderPort {
  /**
   * Evaluate a feature flag and return the full result including variant
   * assignment, rollout decision, and reason.
   */
  evaluate(flagKey: string, context?: FeatureContext): Promise<EvaluationResult>;

  /**
   * Convenience method — returns the resolved variant value, or `undefined`
   * when the flag is disabled or has no variant.
   */
  getVariant(flagKey: string, context?: FeatureContext): Promise<VariantValue | undefined>;

  /**
   * Returns all registered feature flags.
   */
  getAllFlags(): Promise<ReadonlyArray<FeatureFlag>>;

  /**
   * Returns `true` when the provider is reachable and healthy.
   */
  checkHealth(): Promise<boolean>;
}
