import { describe, expect, it } from 'vitest';
import {
  FeatureFlagNotFoundError,
  FeatureProviderError,
  TargetingRuleError,
} from '../src/FeatureErrors.js';
import { evaluateRollout, evaluateTargeting } from '../src/TargetingEngine.js';
import { assignVariant } from '../src/ABTestManager.js';
import { InMemoryFeatureProvider } from '../src/InMemoryFeatureProvider.js';
import { FeatureService } from '../src/FeatureService.js';
import type { ABTestVariant, FeatureFlag, TargetingRule } from '../src/FeatureTypes.js';

// ---------------------------------------------------------------------------
// FeatureErrors
// ---------------------------------------------------------------------------
describe('FeatureErrors', () => {
  it('FeatureFlagNotFoundError has correct name and message', () => {
    const err = new FeatureFlagNotFoundError('my-flag');
    expect(err.name).toBe('FeatureFlagNotFoundError');
    expect(err.message).toContain('my-flag');
    expect(err).toBeInstanceOf(Error);
  });

  it('FeatureProviderError has correct name and optional cause', () => {
    const cause = new Error('backend');
    const err = new FeatureProviderError('provider down', cause);
    expect(err.name).toBe('FeatureProviderError');
    expect(err.cause).toBe(cause);
  });

  it('FeatureProviderError without cause', () => {
    const err = new FeatureProviderError('oops');
    expect(err.cause).toBeUndefined();
  });

  it('TargetingRuleError contains flag key and reason', () => {
    const err = new TargetingRuleError('flag-x', 'missing attributeKey');
    expect(err.name).toBe('TargetingRuleError');
    expect(err.message).toContain('flag-x');
    expect(err.message).toContain('missing attributeKey');
  });
});

// ---------------------------------------------------------------------------
// TargetingEngine
// ---------------------------------------------------------------------------
describe('TargetingEngine', () => {
  describe('evaluateTargeting — operators', () => {
    it('equals — match', () => {
      const rules: TargetingRule[] = [{ attribute: 'userId', operator: 'equals', value: 'u1' }];
      expect(evaluateTargeting(rules, { userId: 'u1' })).toBe(true);
    });

    it('equals — no match', () => {
      const rules: TargetingRule[] = [{ attribute: 'userId', operator: 'equals', value: 'u1' }];
      expect(evaluateTargeting(rules, { userId: 'u2' })).toBe(false);
    });

    it('notEquals — match', () => {
      const rules: TargetingRule[] = [{ attribute: 'userId', operator: 'notEquals', value: 'u1' }];
      expect(evaluateTargeting(rules, { userId: 'u2' })).toBe(true);
    });

    it('contains — match', () => {
      const rules: TargetingRule[] = [{ attribute: 'email', operator: 'contains', value: '@acme' }];
      expect(evaluateTargeting(rules, { email: 'alice@acme.com' })).toBe(true);
    });

    it('contains — no match', () => {
      const rules: TargetingRule[] = [{ attribute: 'email', operator: 'contains', value: '@acme' }];
      expect(evaluateTargeting(rules, { email: 'alice@other.com' })).toBe(false);
    });

    it('in — match', () => {
      const rules: TargetingRule[] = [
        { attribute: 'tenantId', operator: 'in', value: ['t1', 't2'] },
      ];
      expect(evaluateTargeting(rules, { tenantId: 't2' })).toBe(true);
    });

    it('in — no match', () => {
      const rules: TargetingRule[] = [
        { attribute: 'tenantId', operator: 'in', value: ['t1', 't2'] },
      ];
      expect(evaluateTargeting(rules, { tenantId: 't3' })).toBe(false);
    });

    it('notIn — match', () => {
      const rules: TargetingRule[] = [{ attribute: 'tenantId', operator: 'notIn', value: ['t1'] }];
      expect(evaluateTargeting(rules, { tenantId: 't2' })).toBe(true);
    });

    it('notIn — no match', () => {
      const rules: TargetingRule[] = [{ attribute: 'tenantId', operator: 'notIn', value: ['t1'] }];
      expect(evaluateTargeting(rules, { tenantId: 't1' })).toBe(false);
    });

    it('missing context value returns false', () => {
      const rules: TargetingRule[] = [{ attribute: 'userId', operator: 'equals', value: 'u1' }];
      expect(evaluateTargeting(rules, {})).toBe(false);
    });

    it('attribute with attributeKey', () => {
      const rules: TargetingRule[] = [
        { attribute: 'attribute', operator: 'equals', value: 'beta', attributeKey: 'tier' },
      ];
      expect(evaluateTargeting(rules, { attributes: { tier: 'beta' } })).toBe(true);
      expect(evaluateTargeting(rules, { attributes: { tier: 'free' } })).toBe(false);
    });
  });

  describe('evaluateRollout', () => {
    it('0% — always excluded', () => {
      expect(evaluateRollout({ percentage: 0 }, 'flag', { userId: 'any' })).toBe(false);
    });

    it('100% — always included', () => {
      expect(evaluateRollout({ percentage: 100 }, 'flag', { userId: 'any' })).toBe(true);
    });

    it('deterministic — same user always gets the same result', () => {
      const rollout = { percentage: 50 };
      const r1 = evaluateRollout(rollout, 'flag', { userId: 'user-42' });
      const r2 = evaluateRollout(rollout, 'flag', { userId: 'user-42' });
      expect(r1).toBe(r2);
    });

    it('explicit seed overrides userId', () => {
      const rollout1 = { percentage: 50, seed: 'fixed-seed' };
      const rollout2 = { percentage: 50, seed: 'fixed-seed' };
      expect(evaluateRollout(rollout1, 'flag', { userId: 'userA' })).toBe(
        evaluateRollout(rollout2, 'flag', { userId: 'userB' }),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// ABTestManager
// ---------------------------------------------------------------------------
describe('ABTestManager — assignVariant', () => {
  const variants: ABTestVariant[] = [
    { name: 'control', value: 'ctrl', weight: 50 },
    { name: 'treatment', value: 'trt', weight: 50 },
  ];

  it('returns undefined for empty variants array', () => {
    expect(assignVariant('flag', [])).toBeUndefined();
  });

  it('returns undefined when all weights are zero', () => {
    const zeroWeights: ABTestVariant[] = [{ name: 'v', value: 'x', weight: 0 }];
    expect(assignVariant('flag', zeroWeights)).toBeUndefined();
  });

  it('is deterministic for same flag + context', () => {
    const r1 = assignVariant('flag', variants, { userId: 'u1' });
    const r2 = assignVariant('flag', variants, { userId: 'u1' });
    expect(r1?.name).toBe(r2?.name);
  });

  it('returns one of the declared variant names', () => {
    const result = assignVariant('flag', variants, { userId: 'u999' });
    expect(['control', 'treatment']).toContain(result?.name);
  });
});

// ---------------------------------------------------------------------------
// InMemoryFeatureProvider
// ---------------------------------------------------------------------------
describe('InMemoryFeatureProvider', () => {
  const makeProvider = (): InMemoryFeatureProvider => new InMemoryFeatureProvider();

  describe('flag management', () => {
    it('setFlag makes flag evaluable', async () => {
      const p = makeProvider();
      p.setFlag({ key: 'f1', enabled: true });
      const r = await p.evaluate('f1');
      expect(r.enabled).toBe(true);
      expect(r.reason).toBe('DEFAULT');
    });

    it('removeFlag returns true and flag becomes not-found', async () => {
      const p = makeProvider();
      p.setFlag({ key: 'f1', enabled: true });
      expect(p.removeFlag('f1')).toBe(true);
      const r = await p.evaluate('f1');
      expect(r.reason).toBe('FLAG_NOT_FOUND');
    });

    it('enable a disabled flag', async () => {
      const p = makeProvider();
      p.setFlag({ key: 'f1', enabled: false });
      p.enable('f1');
      const r = await p.evaluate('f1');
      expect(r.enabled).toBe(true);
    });

    it('disable an enabled flag', async () => {
      const p = makeProvider();
      p.setFlag({ key: 'f1', enabled: true });
      p.disable('f1');
      const r = await p.evaluate('f1');
      expect(r.enabled).toBe(false);
      expect(r.reason).toBe('FLAG_DISABLED');
    });

    it('enable on missing flag throws FeatureFlagNotFoundError', () => {
      const p = makeProvider();
      expect(() => p.enable('missing')).toThrow(FeatureFlagNotFoundError);
    });

    it('disable on missing flag throws FeatureFlagNotFoundError', () => {
      const p = makeProvider();
      expect(() => p.disable('missing')).toThrow(FeatureFlagNotFoundError);
    });
  });

  describe('evaluate — reasons', () => {
    it('FLAG_NOT_FOUND when key not registered', async () => {
      const p = makeProvider();
      const r = await p.evaluate('unknown');
      expect(r.enabled).toBe(false);
      expect(r.reason).toBe('FLAG_NOT_FOUND');
    });

    it('FLAG_DISABLED when flag is disabled', async () => {
      const p = makeProvider();
      p.setFlag({ key: 'f', enabled: false });
      const r = await p.evaluate('f');
      expect(r.reason).toBe('FLAG_DISABLED');
    });

    it('TARGETING_MATCH when targeting rule matches', async () => {
      const p = makeProvider();
      const flag: FeatureFlag = {
        key: 'f',
        enabled: true,
        targeting: [{ attribute: 'userId', operator: 'equals', value: 'alice' }],
      };
      p.setFlag(flag);
      const r = await p.evaluate('f', { userId: 'alice' });
      expect(r.enabled).toBe(true);
      expect(r.reason).toBe('TARGETING_MATCH');
    });

    it('TARGETING_NO_MATCH when targeting rule does not match', async () => {
      const p = makeProvider();
      const flag: FeatureFlag = {
        key: 'f',
        enabled: true,
        targeting: [{ attribute: 'userId', operator: 'equals', value: 'alice' }],
      };
      p.setFlag(flag);
      const r = await p.evaluate('f', { userId: 'bob' });
      expect(r.enabled).toBe(false);
      expect(r.reason).toBe('TARGETING_NO_MATCH');
    });

    it('ROLLOUT_INCLUDED at 100%', async () => {
      const p = makeProvider();
      p.setFlag({ key: 'f', enabled: true, rollout: { percentage: 100 } });
      const r = await p.evaluate('f', { userId: 'u' });
      expect(r.enabled).toBe(true);
      expect(r.reason).toBe('ROLLOUT_INCLUDED');
    });

    it('ROLLOUT_EXCLUDED at 0%', async () => {
      const p = makeProvider();
      p.setFlag({ key: 'f', enabled: true, rollout: { percentage: 0 } });
      const r = await p.evaluate('f', { userId: 'u' });
      expect(r.enabled).toBe(false);
      expect(r.reason).toBe('ROLLOUT_EXCLUDED');
    });

    it('AB_TEST assigns a variant', async () => {
      const p = makeProvider();
      const flag: FeatureFlag = {
        key: 'f',
        enabled: true,
        variants: [
          { name: 'control', value: 'off', weight: 50 },
          { name: 'treatment', value: 'on', weight: 50 },
        ],
      };
      p.setFlag(flag);
      const r = await p.evaluate('f', { userId: 'tester' });
      expect(r.enabled).toBe(true);
      expect(r.reason).toBe('AB_TEST');
      expect(['control', 'treatment']).toContain(r.variant);
    });

    it('defaultVariant fallback when variants weight is zero', async () => {
      const p = makeProvider();
      const flag: FeatureFlag = {
        key: 'f',
        enabled: true,
        variants: [{ name: 'v', value: true, weight: 0 }],
        defaultVariant: 'v',
      };
      p.setFlag(flag);
      const r = await p.evaluate('f');
      expect(r.variant).toBe('v');
    });
  });

  describe('getVariant', () => {
    it('returns variant value when flag has AB_TEST variant', async () => {
      const p = makeProvider();
      p.setFlag({
        key: 'f',
        enabled: true,
        variants: [{ name: 'blue', value: 'blue', weight: 100 }],
      });
      const v = await p.getVariant('f', { userId: 'u' });
      expect(v).toBe('blue');
    });

    it('returns undefined when flag is disabled', async () => {
      const p = makeProvider();
      p.setFlag({ key: 'f', enabled: false });
      expect(await p.getVariant('f')).toBeUndefined();
    });
  });

  describe('getAllFlags', () => {
    it('returns all registered flags', async () => {
      const p = makeProvider();
      p.setFlag({ key: 'a', enabled: true });
      p.setFlag({ key: 'b', enabled: false });
      const flags = await p.getAllFlags();
      expect(flags).toHaveLength(2);
    });
  });

  describe('checkHealth', () => {
    it('returns true', async () => {
      expect(await makeProvider().checkHealth()).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// FeatureService
// ---------------------------------------------------------------------------
describe('FeatureService', () => {
  const makeService = (): { service: FeatureService; provider: InMemoryFeatureProvider } => {
    const provider = new InMemoryFeatureProvider();
    const service = new FeatureService(provider);
    return { service, provider };
  };

  it('isEnabled returns true for an enabled flag', async () => {
    const { service, provider } = makeService();
    provider.setFlag({ key: 'f', enabled: true });
    expect(await service.isEnabled('f')).toBe(true);
  });

  it('isEnabled returns false for a disabled flag', async () => {
    const { service, provider } = makeService();
    provider.setFlag({ key: 'f', enabled: false });
    expect(await service.isEnabled('f')).toBe(false);
  });

  it('getVariant delegates to provider', async () => {
    const { service, provider } = makeService();
    provider.setFlag({
      key: 'f',
      enabled: true,
      variants: [{ name: 'x', value: 42, weight: 100 }],
    });
    expect(await service.getVariant('f', { userId: 'u' })).toBe(42);
  });

  it('evaluate returns full EvaluationResult', async () => {
    const { service, provider } = makeService();
    provider.setFlag({ key: 'f', enabled: true });
    const r = await service.evaluate('f');
    expect(r.flagKey).toBe('f');
    expect(r.reason).toBeDefined();
  });

  it('getAllFlags proxies provider', async () => {
    const { service, provider } = makeService();
    provider.setFlag({ key: 'f1', enabled: true });
    provider.setFlag({ key: 'f2', enabled: true });
    const flags = await service.getAllFlags();
    expect(flags).toHaveLength(2);
  });

  it('checkHealth proxies provider', async () => {
    const { service } = makeService();
    expect(await service.checkHealth()).toBe(true);
  });

  it('isEnabledForUser passes userId in context', async () => {
    const { service, provider } = makeService();
    provider.setFlag({
      key: 'f',
      enabled: true,
      targeting: [{ attribute: 'userId', operator: 'equals', value: 'alice' }],
    });
    expect(await service.isEnabledForUser('f', 'alice')).toBe(true);
    expect(await service.isEnabledForUser('f', 'bob')).toBe(false);
  });

  it('isEnabledForTenant passes tenantId in context', async () => {
    const { service, provider } = makeService();
    provider.setFlag({
      key: 'f',
      enabled: true,
      targeting: [{ attribute: 'tenantId', operator: 'equals', value: 'acme' }],
    });
    expect(await service.isEnabledForTenant('f', 'acme')).toBe(true);
    expect(await service.isEnabledForTenant('f', 'other')).toBe(false);
  });
});
