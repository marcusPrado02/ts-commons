import type {
  EvaluationReason,
  EvaluationResult,
  FeatureContext,
  FeatureFlag,
  VariantValue,
} from './FeatureTypes.js';
import type { FeatureProviderPort } from './FeaturePort.js';
import { evaluateRollout, evaluateTargeting } from './TargetingEngine.js';
import { assignVariant } from './ABTestManager.js';
import { FeatureFlagNotFoundError } from './FeatureErrors.js';

function buildVariantResult(
  flagKey: string,
  reason: EvaluationReason,
  flag: FeatureFlag,
  context?: FeatureContext,
): EvaluationResult {
  const { variants, defaultVariant } = flag;
  if (variants !== undefined && variants.length > 0) {
    const assigned = assignVariant(flagKey, variants, context);
    if (assigned !== undefined) {
      return { flagKey, enabled: true, variant: assigned.name, value: assigned.value, reason };
    }
  }
  if (defaultVariant !== undefined) {
    return { flagKey, enabled: true, variant: defaultVariant, reason };
  }
  return { flagKey, enabled: true, reason };
}

function evaluateEnabledFlag(flag: FeatureFlag, context?: FeatureContext): EvaluationResult {
  const { targeting, rollout, variants } = flag;

  if (targeting !== undefined && targeting.length > 0) {
    const ctx: FeatureContext = context ?? {};
    if (evaluateTargeting(targeting, ctx)) {
      return buildVariantResult(flag.key, 'TARGETING_MATCH', flag, context);
    }
    return { flagKey: flag.key, enabled: false, reason: 'TARGETING_NO_MATCH' };
  }

  if (rollout !== undefined) {
    if (!evaluateRollout(rollout, flag.key, context)) {
      return { flagKey: flag.key, enabled: false, reason: 'ROLLOUT_EXCLUDED' };
    }
    return buildVariantResult(flag.key, 'ROLLOUT_INCLUDED', flag, context);
  }

  if (variants !== undefined && variants.length > 0) {
    return buildVariantResult(flag.key, 'AB_TEST', flag, context);
  }

  return { flagKey: flag.key, enabled: true, reason: 'DEFAULT' };
}

/**
 * In-memory implementation of `FeatureProviderPort`.
 * Suitable for tests and local development.
 * Supports full targeting, rollout, and A/B variant assignment.
 */
export class InMemoryFeatureProvider implements FeatureProviderPort {
  private readonly flags = new Map<string, FeatureFlag>();

  /** Register or replace a feature flag. */
  setFlag(flag: FeatureFlag): void {
    this.flags.set(flag.key, flag);
  }

  /** Remove a flag. Returns `true` if it existed. */
  removeFlag(key: string): boolean {
    return this.flags.delete(key);
  }

  /** Enable an existing flag. Throws `FeatureFlagNotFoundError` if not found. */
  enable(key: string): void {
    const flag = this.flags.get(key);
    if (flag === undefined) throw new FeatureFlagNotFoundError(key);
    this.flags.set(key, { ...flag, enabled: true });
  }

  /** Disable an existing flag. Throws `FeatureFlagNotFoundError` if not found. */
  disable(key: string): void {
    const flag = this.flags.get(key);
    if (flag === undefined) throw new FeatureFlagNotFoundError(key);
    this.flags.set(key, { ...flag, enabled: false });
  }

  async evaluate(flagKey: string, context?: FeatureContext): Promise<EvaluationResult> {
    const flag = this.flags.get(flagKey);
    if (flag === undefined) {
      return Promise.resolve({ flagKey, enabled: false, reason: 'FLAG_NOT_FOUND' });
    }
    if (!flag.enabled) {
      return Promise.resolve({ flagKey, enabled: false, reason: 'FLAG_DISABLED' });
    }
    return Promise.resolve(evaluateEnabledFlag(flag, context));
  }

  async getVariant(flagKey: string, context?: FeatureContext): Promise<VariantValue | undefined> {
    const result = await this.evaluate(flagKey, context);
    return result.value;
  }

  async getAllFlags(): Promise<ReadonlyArray<FeatureFlag>> {
    return Promise.resolve(Array.from(this.flags.values()));
  }

  async checkHealth(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
