/**
 * Thrown when a flag key that does not exist is referenced.
 */
export class FeatureFlagNotFoundError extends Error {
  override readonly name = 'FeatureFlagNotFoundError';

  constructor(flagKey: string) {
    super(`Feature flag not found: '${flagKey}'`);
  }
}

/**
 * Thrown when the underlying feature provider encounters an unexpected error.
 */
export class FeatureProviderError extends Error {
  override readonly name = 'FeatureProviderError';

  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
  }
}

/**
 * Thrown when a targeting rule is configured incorrectly (e.g. missing
 * `attributeKey` for an `attribute`-type rule).
 */
export class TargetingRuleError extends Error {
  override readonly name = 'TargetingRuleError';

  constructor(flagKey: string, reason: string) {
    super(`Targeting rule error for flag '${flagKey}': ${reason}`);
  }
}
