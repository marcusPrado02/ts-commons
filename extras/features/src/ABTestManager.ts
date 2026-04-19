import type { ABTestVariant, FeatureContext, VariantValue } from './FeatureTypes.js';

/**
 * Deterministic polynomial hash used for variant bucket assignment.
 */
function hashForAB(flagKey: string, context?: FeatureContext): number {
  const seed = context?.userId ?? context?.tenantId ?? 'anonymous';
  const input = `${flagKey}:${seed}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) % 2_147_483_647;
  }
  return hash;
}

/**
 * Deterministically assigns a variant to a user based on flag key and context.
 * Variants are selected proportionally to their `weight` values.
 *
 * Returns `undefined` when `variants` is empty or total weight is zero.
 */
export function assignVariant(
  flagKey: string,
  variants: ReadonlyArray<ABTestVariant>,
  context?: FeatureContext,
): { name: string; value: VariantValue } | undefined {
  if (variants.length === 0) return undefined;

  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  if (totalWeight === 0) return undefined;

  const bucket = hashForAB(flagKey, context) % totalWeight;

  let cumulative = 0;
  for (const variant of variants) {
    cumulative += variant.weight;
    if (bucket < cumulative) {
      return { name: variant.name, value: variant.value };
    }
  }

  // Fallback to last variant (floating-point safety net).
  const last = variants[variants.length - 1];
  if (last === undefined) return undefined;
  return { name: last.name, value: last.value };
}
