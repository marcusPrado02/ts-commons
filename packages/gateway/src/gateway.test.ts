/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import {
  buildKongService,
  buildKongRateLimitPlugin,
  buildKongKeyAuthPlugin,
  buildKongRequestTransformPlugin,
} from './KongConfigBuilder';
import {
  buildRestApiSpec,
  buildUsagePlan,
  buildApiKeyResource,
  buildStageConfig,
} from './AwsGatewayBuilder';
import { buildApimPolicy, buildProductConfig, buildApiConfig } from './AzureApimBuilder';
import {
  validateRateLimit,
  validateApiKey,
  validateCacheConfig,
  validateRouteConfig,
} from './GatewayValidator';
import type {
  GatewayServiceConfig,
  GatewayRouteConfig,
  RateLimitConfig,
  ApiKeyConfig,
  AwsApiConfig,
  AzureApimConfig,
  ResponseCacheConfig,
} from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeService(overrides?: Partial<GatewayServiceConfig>): GatewayServiceConfig {
  return {
    name: 'ts-commons',
    url: 'http://ts-commons:3000',
    routes: [{ name: 'default', paths: ['/v1'] }],
    ...overrides,
  };
}

function makeRoute(overrides?: Partial<GatewayRouteConfig>): GatewayRouteConfig {
  return { name: 'my-route', paths: ['/api'], ...overrides };
}

function makeRateLimit(overrides?: Partial<RateLimitConfig>): RateLimitConfig {
  return { requestsPerMinute: 100, ...overrides };
}

function makeApiKey(overrides?: Partial<ApiKeyConfig>): ApiKeyConfig {
  return { headerName: 'X-Api-Key', ...overrides };
}

function makeAwsConfig(overrides?: Partial<AwsApiConfig>): AwsApiConfig {
  return {
    name: 'ts-commons-api',
    stageName: 'prod',
    usagePlanName: 'ts-commons-plan',
    ...overrides,
  };
}

function makeApimConfig(overrides?: Partial<AzureApimConfig>): AzureApimConfig {
  return {
    serviceName: 'my-apim',
    apiName: 'ts-commons',
    path: 'ts-commons',
    productName: 'ts-commons-product',
    ...overrides,
  };
}

function makeCache(overrides?: Partial<ResponseCacheConfig>): ResponseCacheConfig {
  return { strategy: 'cache-first', ttlSeconds: 300, ...overrides };
}

// ── KongConfigBuilder ─────────────────────────────────────────────────────────

describe('buildKongService', () => {
  it('sets name', () => {
    const s = buildKongService(makeService()) as any;
    expect(s.name).toBe('ts-commons');
  });

  it('sets url', () => {
    const s = buildKongService(makeService()) as any;
    expect(s.url).toBe('http://ts-commons:3000');
  });

  it('defaults connect_timeout to 60000', () => {
    const s = buildKongService(makeService()) as any;
    expect(s.connect_timeout).toBe(60000);
  });

  it('uses provided connectTimeout', () => {
    const s = buildKongService(makeService({ connectTimeout: 5000 })) as any;
    expect(s.connect_timeout).toBe(5000);
  });

  it('defaults retries to 5', () => {
    const s = buildKongService(makeService()) as any;
    expect(s.retries).toBe(5);
  });

  it('uses provided retries', () => {
    const s = buildKongService(makeService({ retries: 3 })) as any;
    expect(s.retries).toBe(3);
  });

  it('includes routes', () => {
    const s = buildKongService(makeService()) as any;
    expect(s.routes).toHaveLength(1);
    expect(s.routes[0].name).toBe('default');
  });

  it('sets route paths', () => {
    const s = buildKongService(makeService()) as any;
    expect(s.routes[0].paths).toEqual(['/v1']);
  });

  it('defaults strip_path to true', () => {
    const s = buildKongService(makeService()) as any;
    expect(s.routes[0].strip_path).toBe(true);
  });

  it('sets strip_path false when specified', () => {
    const s = buildKongService(makeService({ routes: [makeRoute({ stripPath: false })] })) as any;
    expect(s.routes[0].strip_path).toBe(false);
  });

  it('includes methods when provided', () => {
    const s = buildKongService(
      makeService({ routes: [makeRoute({ methods: ['GET', 'POST'] })] }),
    ) as any;
    expect(s.routes[0].methods).toEqual(['GET', 'POST']);
  });

  it('adds rate-limiting plugin to route', () => {
    const s = buildKongService(
      makeService({ routes: [makeRoute({ rateLimit: makeRateLimit() })] }),
    ) as any;
    const plugin = s.routes[0].plugins.find((p: any) => p.name === 'rate-limiting');
    expect(plugin).toBeDefined();
    expect(plugin.config.minute).toBe(100);
  });

  it('adds key-auth plugin to route', () => {
    const s = buildKongService(
      makeService({ routes: [makeRoute({ apiKey: makeApiKey() })] }),
    ) as any;
    const plugin = s.routes[0].plugins.find((p: any) => p.name === 'key-auth');
    expect(plugin).toBeDefined();
    expect(plugin.config.key_names).toContain('X-Api-Key');
  });

  it('adds request-transformer plugin to route', () => {
    const s = buildKongService(
      makeService({ routes: [makeRoute({ requestTransform: { addHeaders: { 'X-Src': 'gw' } } })] }),
    ) as any;
    const plugin = s.routes[0].plugins.find((p: any) => p.name === 'request-transformer');
    expect(plugin).toBeDefined();
  });

  it('route has empty plugins array when none configured', () => {
    const s = buildKongService(makeService()) as any;
    expect(s.routes[0].plugins).toHaveLength(0);
  });
});

describe('buildKongRateLimitPlugin', () => {
  it('name is rate-limiting', () => {
    const p = buildKongRateLimitPlugin(makeRateLimit()) as any;
    expect(p.name).toBe('rate-limiting');
  });

  it('sets minute limit', () => {
    const p = buildKongRateLimitPlugin({ requestsPerMinute: 200 }) as any;
    expect(p.config.minute).toBe(200);
  });

  it('sets second limit', () => {
    const p = buildKongRateLimitPlugin({ requestsPerSecond: 50 }) as any;
    expect(p.config.second).toBe(50);
  });

  it('uses cluster policy by default', () => {
    const p = buildKongRateLimitPlugin(makeRateLimit()) as any;
    expect(p.config.policy).toBe('cluster');
  });

  it('uses local policy by-ip', () => {
    const p = buildKongRateLimitPlugin({ requestsPerMinute: 60, byIp: true }) as any;
    expect(p.config.policy).toBe('local');
  });
});

describe('buildKongKeyAuthPlugin', () => {
  it('name is key-auth', () => {
    const p = buildKongKeyAuthPlugin(makeApiKey()) as any;
    expect(p.name).toBe('key-auth');
  });

  it('sets key_names from headerName', () => {
    const p = buildKongKeyAuthPlugin({ headerName: 'Authorization' }) as any;
    expect(p.config.key_names).toContain('Authorization');
  });

  it('hides credentials by default', () => {
    const p = buildKongKeyAuthPlugin(makeApiKey()) as any;
    expect(p.config.hide_credentials).toBe(true);
  });

  it('respects hideCredentials: false', () => {
    const p = buildKongKeyAuthPlugin({ headerName: 'X-Key', hideCredentials: false }) as any;
    expect(p.config.hide_credentials).toBe(false);
  });
});

describe('buildKongRequestTransformPlugin', () => {
  it('name is request-transformer', () => {
    const p = buildKongRequestTransformPlugin({ addHeaders: { 'X-A': '1' } }) as any;
    expect(p.name).toBe('request-transformer');
  });

  it('formats addHeaders as key:value strings', () => {
    const p = buildKongRequestTransformPlugin({ addHeaders: { 'X-Src': 'gw' } }) as any;
    expect(p.config.add.headers).toContain('X-Src:gw');
  });

  it('sets remove.headers', () => {
    const p = buildKongRequestTransformPlugin({ removeHeaders: ['X-Token'] }) as any;
    expect(p.config.remove.headers).toContain('X-Token');
  });

  it('formats addQueryParams as key:value strings', () => {
    const p = buildKongRequestTransformPlugin({ addQueryParams: { version: 'v2' } }) as any;
    expect(p.config.add.querystring).toContain('version:v2');
  });
});

// ── AwsGatewayBuilder ─────────────────────────────────────────────────────────

describe('buildRestApiSpec', () => {
  it('sets name', () => {
    const a = buildRestApiSpec(makeAwsConfig()) as any;
    expect(a.name).toBe('ts-commons-api');
  });

  it('sets empty description by default', () => {
    const a = buildRestApiSpec(makeAwsConfig()) as any;
    expect(a.description).toBe('');
  });

  it('uses provided description', () => {
    const a = buildRestApiSpec(makeAwsConfig({ description: 'My API' })) as any;
    expect(a.description).toBe('My API');
  });

  it('sets REGIONAL endpoint', () => {
    const a = buildRestApiSpec(makeAwsConfig()) as any;
    expect(a.endpoint_configuration.types).toContain('REGIONAL');
  });

  it('tags with stage name', () => {
    const a = buildRestApiSpec(makeAwsConfig({ stageName: 'staging' })) as any;
    expect(a.tags.Stage).toBe('staging');
  });
});

describe('buildUsagePlan', () => {
  it('sets name', () => {
    const u = buildUsagePlan(makeAwsConfig()) as any;
    expect(u.name).toBe('ts-commons-plan');
  });

  it('includes api_stages', () => {
    const u = buildUsagePlan(makeAwsConfig()) as any;
    expect(u.api_stages[0].stage).toBe('prod');
  });

  it('omits throttle when no throttle config', () => {
    const u = buildUsagePlan(makeAwsConfig()) as any;
    expect(u.throttle).toBeUndefined();
  });

  it('includes throttle when rateLimit set', () => {
    const u = buildUsagePlan(makeAwsConfig({ throttlingRateLimit: 500 })) as any;
    expect(u.throttle.rate_limit).toBe(500);
  });

  it('defaults burst_limit to 200 when only rate set', () => {
    const u = buildUsagePlan(makeAwsConfig({ throttlingRateLimit: 100 })) as any;
    expect(u.throttle.burst_limit).toBe(200);
  });

  it('includes quota when quotaLimit set', () => {
    const u = buildUsagePlan(makeAwsConfig({ quotaLimit: 10000 })) as any;
    expect(u.quota.limit).toBe(10000);
  });

  it('defaults quota period to DAY', () => {
    const u = buildUsagePlan(makeAwsConfig({ quotaLimit: 5000 })) as any;
    expect(u.quota.period).toBe('DAY');
  });

  it('uses provided quotaPeriod', () => {
    const u = buildUsagePlan(makeAwsConfig({ quotaLimit: 5000, quotaPeriod: 'MONTH' })) as any;
    expect(u.quota.period).toBe('MONTH');
  });

  it('omits quota when not provided', () => {
    const u = buildUsagePlan(makeAwsConfig()) as any;
    expect(u.quota).toBeUndefined();
  });
});

describe('buildApiKeyResource', () => {
  it('sets name', () => {
    const k = buildApiKeyResource('my-key', 'Test key') as any;
    expect(k.name).toBe('my-key');
  });

  it('sets description', () => {
    const k = buildApiKeyResource('my-key', 'Test key') as any;
    expect(k.description).toBe('Test key');
  });

  it('enabled is true', () => {
    const k = buildApiKeyResource('my-key', 'desc') as any;
    expect(k.enabled).toBe(true);
  });
});

describe('buildStageConfig', () => {
  it('sets stage_name', () => {
    const s = buildStageConfig(makeAwsConfig({ stageName: 'staging' })) as any;
    expect(s.stage_name).toBe('staging');
  });

  it('defaults throttling_rate_limit to 100', () => {
    const s = buildStageConfig(makeAwsConfig()) as any;
    expect(s.default_route_settings.throttling_rate_limit).toBe(100);
  });
});

// ── AzureApimBuilder ──────────────────────────────────────────────────────────

describe('buildApimPolicy', () => {
  it('starts with <policies>', () => {
    const xml = buildApimPolicy(makeApimConfig());
    expect(xml).toContain('<policies>');
  });

  it('includes <inbound> block', () => {
    const xml = buildApimPolicy(makeApimConfig());
    expect(xml).toContain('<inbound>');
  });

  it('includes <base /> in inbound', () => {
    const xml = buildApimPolicy(makeApimConfig());
    expect(xml).toContain('<base />');
  });

  it('adds rate-limit element when rateLimit provided', () => {
    const xml = buildApimPolicy(makeApimConfig({ rateLimit: { requestsPerMinute: 60 } }));
    expect(xml).toContain('<rate-limit');
    expect(xml).toContain('calls="60"');
  });

  it('uses per-minute renewal period 60', () => {
    const xml = buildApimPolicy(makeApimConfig({ rateLimit: { requestsPerMinute: 60 } }));
    expect(xml).toContain('renewal-period="60"');
  });

  it('uses per-second renewal period 1', () => {
    const xml = buildApimPolicy(makeApimConfig({ rateLimit: { requestsPerSecond: 10 } }));
    expect(xml).toContain('renewal-period="1"');
  });

  it('adds cache-lookup when responseCache provided', () => {
    const xml = buildApimPolicy(makeApimConfig({ responseCache: makeCache() }));
    expect(xml).toContain('<cache-lookup');
  });

  it('adds cache-store in outbound when responseCache provided', () => {
    const xml = buildApimPolicy(makeApimConfig({ responseCache: makeCache() }));
    expect(xml).toContain('<cache-store');
    expect(xml).toContain('300');
  });

  it('omits cache when not provided', () => {
    const xml = buildApimPolicy(makeApimConfig());
    expect(xml).not.toContain('cache-lookup');
  });
});

describe('buildProductConfig', () => {
  it('sets display_name', () => {
    const p = buildProductConfig(makeApimConfig()) as any;
    expect(p.display_name).toBe('ts-commons-product');
  });

  it('sets api_management_name', () => {
    const p = buildProductConfig(makeApimConfig()) as any;
    expect(p.api_management_name).toBe('my-apim');
  });

  it('published is true', () => {
    const p = buildProductConfig(makeApimConfig()) as any;
    expect(p.published).toBe(true);
  });

  it('subscription_required is true', () => {
    const p = buildProductConfig(makeApimConfig()) as any;
    expect(p.subscription_required).toBe(true);
  });
});

describe('buildApiConfig', () => {
  it('sets name', () => {
    const a = buildApiConfig(makeApimConfig()) as any;
    expect(a.name).toBe('ts-commons');
  });

  it('sets path', () => {
    const a = buildApiConfig(makeApimConfig({ path: 'api/v1' })) as any;
    expect(a.path).toBe('api/v1');
  });

  it('uses https protocol', () => {
    const a = buildApiConfig(makeApimConfig()) as any;
    expect(a.protocols).toContain('https');
  });
});

// ── GatewayValidator ──────────────────────────────────────────────────────────

describe('validateRateLimit', () => {
  it('valid when requestsPerMinute set', () => {
    const r = validateRateLimit({ requestsPerMinute: 100 });
    expect(r.valid).toBe(true);
  });

  it('valid when requestsPerSecond set', () => {
    const r = validateRateLimit({ requestsPerSecond: 10 });
    expect(r.valid).toBe(true);
  });

  it('errors when no limits set', () => {
    const r = validateRateLimit({});
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('at least one'))).toBe(true);
  });

  it('errors when limit < 1', () => {
    const r = validateRateLimit({ requestsPerMinute: 0 });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('>= 1'))).toBe(true);
  });

  it('valid with multiple limits set', () => {
    const r = validateRateLimit({ requestsPerSecond: 5, requestsPerMinute: 100 });
    expect(r.valid).toBe(true);
  });
});

describe('validateApiKey', () => {
  it('valid for correct headerName', () => {
    const r = validateApiKey({ headerName: 'X-Api-Key' });
    expect(r.valid).toBe(true);
  });

  it('errors when headerName is empty', () => {
    const r = validateApiKey({ headerName: '  ' });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('empty'))).toBe(true);
  });

  it('errors when headerName contains invalid chars', () => {
    const r = validateApiKey({ headerName: 'x_api_key' });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('headerName'))).toBe(true);
  });

  it('errors when expireTtlSeconds < 0', () => {
    const r = validateApiKey({ headerName: 'X-Key', expireTtlSeconds: -1 });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('expireTtlSeconds'))).toBe(true);
  });

  it('accepts expireTtlSeconds = 0', () => {
    const r = validateApiKey({ headerName: 'X-Key', expireTtlSeconds: 0 });
    expect(r.valid).toBe(true);
  });
});

describe('validateCacheConfig', () => {
  it('valid for correct config', () => {
    const r = validateCacheConfig(makeCache());
    expect(r.valid).toBe(true);
  });

  it('errors when ttlSeconds <= 0', () => {
    const r = validateCacheConfig(makeCache({ ttlSeconds: 0 }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('ttlSeconds'))).toBe(true);
  });

  it('errors when ttlSeconds > 86400', () => {
    const r = validateCacheConfig(makeCache({ ttlSeconds: 86401 }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('86400'))).toBe(true);
  });

  it('accepts boundary value 86400', () => {
    const r = validateCacheConfig(makeCache({ ttlSeconds: 86400 }));
    expect(r.valid).toBe(true);
  });
});

describe('validateRouteConfig', () => {
  it('valid for correct route', () => {
    const r = validateRouteConfig(makeRoute());
    expect(r.valid).toBe(true);
  });

  it('errors on uppercase route name', () => {
    const r = validateRouteConfig(makeRoute({ name: 'MyRoute' }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('name'))).toBe(true);
  });

  it('errors on empty paths', () => {
    const r = validateRouteConfig(makeRoute({ paths: [] }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('paths'))).toBe(true);
  });

  it('errors on path not starting with /', () => {
    const r = validateRouteConfig(makeRoute({ paths: ['api/v1'] }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('start with /'))).toBe(true);
  });

  it('propagates rateLimit errors', () => {
    const r = validateRouteConfig(makeRoute({ rateLimit: {} }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('at least one'))).toBe(true);
  });

  it('propagates apiKey errors', () => {
    const r = validateRouteConfig(makeRoute({ apiKey: { headerName: '' } }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('empty'))).toBe(true);
  });

  it('propagates cache errors', () => {
    const r = validateRouteConfig(makeRoute({ responseCache: makeCache({ ttlSeconds: -1 }) }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('ttlSeconds'))).toBe(true);
  });
});
