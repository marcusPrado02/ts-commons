/**
 * Core value types for feature flag evaluation.
 */
export type VariantValue = string | number | boolean;

/**
 * Contextual information about the entity requesting flag evaluation.
 */
export interface FeatureContext {
  readonly userId?: string;
  readonly tenantId?: string;
  readonly email?: string;
  readonly attributes?: Readonly<Record<string, string>>;
}

/**
 * Targeting rule operators.
 */
export type RuleOperator = 'equals' | 'notEquals' | 'contains' | 'in' | 'notIn';

/**
 * Attributes that targeting rules can operate on.
 */
export type TargetingAttribute = 'userId' | 'tenantId' | 'email' | 'attribute';

/**
 * A single targeting rule — matched against the evaluation context.
 */
export interface TargetingRule {
  readonly attribute: TargetingAttribute;
  readonly operator: RuleOperator;
  readonly value: string | ReadonlyArray<string>;
  /** Required when `attribute === 'attribute'`; key into `context.attributes`. */
  readonly attributeKey?: string;
}

/**
 * Percentage-based rollout configuration.
 */
export interface RolloutRule {
  /** 0–100, inclusive. */
  readonly percentage: number;
  /** Optional seed for deterministic hashing; defaults to userId/tenantId. */
  readonly seed?: string;
}

/**
 * A single variant for A/B testing.
 */
export interface ABTestVariant {
  readonly name: string;
  readonly value: VariantValue;
  /** Relative weight — weights across all variants should sum to 100. */
  readonly weight: number;
}

/**
 * Full feature flag definition.
 */
export interface FeatureFlag {
  readonly key: string;
  readonly enabled: boolean;
  readonly variants?: ReadonlyArray<ABTestVariant>;
  readonly targeting?: ReadonlyArray<TargetingRule>;
  readonly rollout?: RolloutRule;
  readonly defaultVariant?: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

/**
 * Final reason for an evaluation decision.
 */
export type EvaluationReason =
  | 'DEFAULT'
  | 'FLAG_DISABLED'
  | 'FLAG_NOT_FOUND'
  | 'TARGETING_MATCH'
  | 'TARGETING_NO_MATCH'
  | 'ROLLOUT_INCLUDED'
  | 'ROLLOUT_EXCLUDED'
  | 'AB_TEST';

/**
 * Full result of evaluating a single feature flag.
 */
export interface EvaluationResult {
  readonly flagKey: string;
  readonly enabled: boolean;
  readonly variant?: string;
  readonly value?: VariantValue;
  readonly reason: EvaluationReason;
}
