import type { FeatureContext, RolloutRule, TargetingRule } from './FeatureTypes.js';

/**
 * Deterministic polynomial hash — safe within JS float64 precision
 * for strings up to several hundred characters.
 */
function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) % 2_147_483_647;
  }
  return hash;
}

function getContextValue(
  attribute: string,
  attributeKey: string | undefined,
  ctx: FeatureContext,
): string | undefined {
  if (attribute === 'userId') return ctx.userId;
  if (attribute === 'tenantId') return ctx.tenantId;
  if (attribute === 'email') return ctx.email;
  if (attribute === 'attribute' && attributeKey !== undefined) {
    return ctx.attributes?.[attributeKey];
  }
  return undefined;
}

function evaluateScalarRule(
  operator: 'equals' | 'notEquals' | 'contains',
  actual: string,
  value: string,
): boolean {
  if (operator === 'equals') return actual === value;
  if (operator === 'notEquals') return actual !== value;
  return actual.includes(value); // contains
}

function evaluateArrayRule(
  operator: 'in' | 'notIn',
  actual: string,
  value: ReadonlyArray<string>,
): boolean {
  if (operator === 'in') return value.includes(actual);
  return !value.includes(actual); // notIn
}

function evaluateRule(rule: TargetingRule, context: FeatureContext): boolean {
  const actual = getContextValue(rule.attribute, rule.attributeKey, context);
  if (actual === undefined) return false;

  const { operator, value } = rule;
  if (typeof value === 'string') {
    if (operator === 'in' || operator === 'notIn') return false;
    return evaluateScalarRule(operator, actual, value);
  }
  if (operator === 'in' || operator === 'notIn') {
    return evaluateArrayRule(operator, actual, value);
  }
  return false;
}

/**
 * Returns `true` when **all** targeting rules match the given context.
 */
export function evaluateTargeting(
  rules: ReadonlyArray<TargetingRule>,
  context: FeatureContext,
): boolean {
  return rules.every((rule) => evaluateRule(rule, context));
}

/**
 * Returns `true` when the context falls within the rollout percentage bucket.
 * The bucket is deterministic: the same flag+seed always yields the same result.
 */
export function evaluateRollout(
  rollout: RolloutRule,
  flagKey: string,
  context?: FeatureContext,
): boolean {
  const seed = rollout.seed ?? context?.userId ?? context?.tenantId ?? 'default';
  const hash = hashString(`${flagKey}:${seed}`);
  return hash % 100 < rollout.percentage;
}
