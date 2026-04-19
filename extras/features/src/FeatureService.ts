import type {
  EvaluationResult,
  FeatureContext,
  FeatureFlag,
  VariantValue,
} from './FeatureTypes.js';
import type { FeatureProviderPort } from './FeaturePort.js';

/**
 * High-level service that delegates all evaluation to a `FeatureProviderPort`.
 * Provides convenience helpers for common access patterns.
 */
export class FeatureService {
  constructor(private readonly provider: FeatureProviderPort) {}

  /**
   * Returns `true` when the flag is enabled for the given context.
   */
  async isEnabled(flagKey: string, context?: FeatureContext): Promise<boolean> {
    const result = await this.provider.evaluate(flagKey, context);
    return result.enabled;
  }

  /**
   * Returns the resolved variant value, or `undefined` when disabled / no variant.
   */
  async getVariant(flagKey: string, context?: FeatureContext): Promise<VariantValue | undefined> {
    return this.provider.getVariant(flagKey, context);
  }

  /**
   * Returns the full evaluation result including reason and variant details.
   */
  async evaluate(flagKey: string, context?: FeatureContext): Promise<EvaluationResult> {
    return this.provider.evaluate(flagKey, context);
  }

  /**
   * Returns all registered flags from the provider.
   */
  async getAllFlags(): Promise<ReadonlyArray<FeatureFlag>> {
    return this.provider.getAllFlags();
  }

  /**
   * Returns `true` when the underlying provider is healthy.
   */
  async checkHealth(): Promise<boolean> {
    return this.provider.checkHealth();
  }

  /**
   * Convenience wrapper — evaluates the flag for a specific `userId`.
   */
  async isEnabledForUser(flagKey: string, userId: string): Promise<boolean> {
    return this.isEnabled(flagKey, { userId });
  }

  /**
   * Convenience wrapper — evaluates the flag for a specific `tenantId`.
   */
  async isEnabledForTenant(flagKey: string, tenantId: string): Promise<boolean> {
    return this.isEnabled(flagKey, { tenantId });
  }
}
