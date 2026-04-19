/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import {
  buildVirtualService,
  buildDestinationRule,
  buildPeerAuthentication,
} from './IstioConfigBuilder';
import { buildServer, buildServerAuthorization } from './LinkerdConfigBuilder';
import {
  validateRetryPolicy,
  validateCircuitBreaker,
  validateVirtualService,
  validateDestinationRule,
} from './ServiceMeshValidator';
import type {
  VirtualServiceConfig,
  DestinationRuleConfig,
  PeerAuthenticationConfig,
  LinkerdServerConfig,
  LinkerdAuthorizationConfig,
  RetryPolicy,
  CircuitBreakerConfig,
} from './types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeVSConfig(overrides?: Partial<VirtualServiceConfig>): VirtualServiceConfig {
  return {
    name: 'my-service',
    namespace: 'default',
    hosts: ['my-service'],
    routes: [{ host: 'my-service', port: 3000 }],
    ...overrides,
  };
}

function makeDRConfig(overrides?: Partial<DestinationRuleConfig>): DestinationRuleConfig {
  return {
    name: 'my-service',
    namespace: 'default',
    host: 'my-service',
    mtlsMode: 'STRICT',
    ...overrides,
  };
}

function makeRetry(overrides?: Partial<RetryPolicy>): RetryPolicy {
  return {
    attempts: 3,
    perTryTimeout: '2s',
    retryOn: 'gateway-error,connect-failure',
    ...overrides,
  };
}

// ── IstioConfigBuilder ────────────────────────────────────────────────────────

describe('buildVirtualService', () => {
  it('sets metadata name', () => {
    const vs = buildVirtualService(makeVSConfig()) as any;
    expect(vs.metadata.name).toBe('my-service');
  });

  it('sets metadata namespace', () => {
    const vs = buildVirtualService(makeVSConfig()) as any;
    expect(vs.metadata.namespace).toBe('default');
  });

  it('sets apiVersion networking.istio.io/v1beta1', () => {
    const vs = buildVirtualService(makeVSConfig()) as any;
    expect(vs.apiVersion).toBe('networking.istio.io/v1beta1');
  });

  it('sets kind VirtualService', () => {
    const vs = buildVirtualService(makeVSConfig()) as any;
    expect(vs.kind).toBe('VirtualService');
  });

  it('sets spec.hosts', () => {
    const vs = buildVirtualService(makeVSConfig({ hosts: ['svc-a', 'svc-b'] })) as any;
    expect(vs.spec.hosts).toEqual(['svc-a', 'svc-b']);
  });

  it('does not include gateways when not provided', () => {
    const vs = buildVirtualService(makeVSConfig()) as any;
    expect(vs.spec.gateways).toBeUndefined();
  });

  it('includes gateways when provided', () => {
    const vs = buildVirtualService(makeVSConfig({ gateways: ['my-gateway'] })) as any;
    expect(vs.spec.gateways).toEqual(['my-gateway']);
  });

  it('sets route destination host', () => {
    const vs = buildVirtualService(makeVSConfig()) as any;
    expect(vs.spec.http[0].route[0].destination.host).toBe('my-service');
  });

  it('sets route destination port', () => {
    const vs = buildVirtualService(makeVSConfig()) as any;
    expect(vs.spec.http[0].route[0].destination.port.number).toBe(3000);
  });

  it('includes timeout when provided', () => {
    const vs = buildVirtualService(makeVSConfig({ timeout: '10s' })) as any;
    expect(vs.spec.http[0].timeout).toBe('10s');
  });

  it('includes retries when retryPolicy provided', () => {
    const vs = buildVirtualService(makeVSConfig({ retryPolicy: makeRetry() })) as any;
    expect(vs.spec.http[0].retries.attempts).toBe(3);
  });

  it('sets retry perTryTimeout', () => {
    const vs = buildVirtualService(makeVSConfig({ retryPolicy: makeRetry() })) as any;
    expect(vs.spec.http[0].retries.perTryTimeout).toBe('2s');
  });

  it('sets route weight when provided', () => {
    const config = makeVSConfig({
      routes: [
        { host: 'v1', port: 3000, weight: 80 },
        { host: 'v2', port: 3000, weight: 20 },
      ],
    });
    const vs = buildVirtualService(config) as any;
    expect(vs.spec.http[0].route[0].weight).toBe(80);
    expect(vs.spec.http[0].route[1].weight).toBe(20);
  });

  it('omits weight when not provided', () => {
    const vs = buildVirtualService(makeVSConfig()) as any;
    expect(vs.spec.http[0].route[0].weight).toBeUndefined();
  });
});

describe('buildDestinationRule', () => {
  it('sets metadata name and namespace', () => {
    const dr = buildDestinationRule(makeDRConfig()) as any;
    expect(dr.metadata.name).toBe('my-service');
    expect(dr.metadata.namespace).toBe('default');
  });

  it('sets apiVersion networking.istio.io/v1beta1', () => {
    const dr = buildDestinationRule(makeDRConfig()) as any;
    expect(dr.apiVersion).toBe('networking.istio.io/v1beta1');
  });

  it('sets kind DestinationRule', () => {
    const dr = buildDestinationRule(makeDRConfig()) as any;
    expect(dr.kind).toBe('DestinationRule');
  });

  it('sets spec.host', () => {
    const dr = buildDestinationRule(makeDRConfig({ host: 'other-svc' })) as any;
    expect(dr.spec.host).toBe('other-svc');
  });

  it('sets trafficPolicy.tls.mode STRICT', () => {
    const dr = buildDestinationRule(makeDRConfig({ mtlsMode: 'STRICT' })) as any;
    expect(dr.spec.trafficPolicy.tls.mode).toBe('STRICT');
  });

  it('sets trafficPolicy.tls.mode PERMISSIVE', () => {
    const dr = buildDestinationRule(makeDRConfig({ mtlsMode: 'PERMISSIVE' })) as any;
    expect(dr.spec.trafficPolicy.tls.mode).toBe('PERMISSIVE');
  });

  it('sets trafficPolicy.tls.mode DISABLE', () => {
    const dr = buildDestinationRule(makeDRConfig({ mtlsMode: 'DISABLE' })) as any;
    expect(dr.spec.trafficPolicy.tls.mode).toBe('DISABLE');
  });

  it('sets loadBalancer when loadBalancingPolicy provided', () => {
    const dr = buildDestinationRule(makeDRConfig({ loadBalancingPolicy: 'LEAST_CONN' })) as any;
    expect(dr.spec.trafficPolicy.loadBalancer.simple).toBe('LEAST_CONN');
  });

  it('omits loadBalancer when not provided', () => {
    const dr = buildDestinationRule(makeDRConfig()) as any;
    expect(dr.spec.trafficPolicy.loadBalancer).toBeUndefined();
  });

  it('sets outlierDetection.consecutive5xxErrors', () => {
    const cb: CircuitBreakerConfig = {
      consecutive5xxErrors: 5,
      interval: '30s',
      baseEjectionTime: '30s',
    };
    const dr = buildDestinationRule(makeDRConfig({ circuitBreaker: cb })) as any;
    expect(dr.spec.trafficPolicy.outlierDetection.consecutive5xxErrors).toBe(5);
  });

  it('sets outlierDetection.maxEjectionPercent', () => {
    const cb: CircuitBreakerConfig = { consecutive5xxErrors: 5, maxEjectionPercent: 50 };
    const dr = buildDestinationRule(makeDRConfig({ circuitBreaker: cb })) as any;
    expect(dr.spec.trafficPolicy.outlierDetection.maxEjectionPercent).toBe(50);
  });

  it('sets connectionPool.http1MaxPendingRequests', () => {
    const dr = buildDestinationRule(
      makeDRConfig({ connectionPool: { http1MaxPendingRequests: 50 } }),
    ) as any;
    expect(dr.spec.trafficPolicy.connectionPool.http.http1MaxPendingRequests).toBe(50);
  });

  it('sets connectionPool.tcp.maxConnections', () => {
    const dr = buildDestinationRule(
      makeDRConfig({ connectionPool: { maxConnectionsPerHost: 100 } }),
    ) as any;
    expect(dr.spec.trafficPolicy.connectionPool.tcp.maxConnections).toBe(100);
  });
});

describe('buildPeerAuthentication', () => {
  it('sets apiVersion security.istio.io/v1beta1', () => {
    const pa = buildPeerAuthentication({
      name: 'default',
      namespace: 'default',
      mtlsMode: 'STRICT',
    }) as any;
    expect(pa.apiVersion).toBe('security.istio.io/v1beta1');
  });

  it('sets kind PeerAuthentication', () => {
    const pa = buildPeerAuthentication({
      name: 'default',
      namespace: 'default',
      mtlsMode: 'STRICT',
    }) as any;
    expect(pa.kind).toBe('PeerAuthentication');
  });

  it('sets mtls.mode STRICT', () => {
    const pa = buildPeerAuthentication({ name: 'pa', namespace: 'ns', mtlsMode: 'STRICT' }) as any;
    expect(pa.spec.mtls.mode).toBe('STRICT');
  });

  it('sets mtls.mode PERMISSIVE', () => {
    const pa = buildPeerAuthentication({
      name: 'pa',
      namespace: 'ns',
      mtlsMode: 'PERMISSIVE',
    }) as any;
    expect(pa.spec.mtls.mode).toBe('PERMISSIVE');
  });

  it('omits portLevelMtls when not provided', () => {
    const pa = buildPeerAuthentication({ name: 'pa', namespace: 'ns', mtlsMode: 'STRICT' }) as any;
    expect(pa.spec.portLevelMtls).toBeUndefined();
  });

  it('includes portLevelMtls when provided', () => {
    const config: PeerAuthenticationConfig = {
      name: 'pa',
      namespace: 'ns',
      mtlsMode: 'STRICT',
      portLevelMtls: { '8080': 'PERMISSIVE' },
    };
    const pa = buildPeerAuthentication(config) as any;
    expect(pa.spec.portLevelMtls['8080'].mode).toBe('PERMISSIVE');
  });
});

// ── LinkerdConfigBuilder ──────────────────────────────────────────────────────

describe('buildServer', () => {
  const base: LinkerdServerConfig = {
    name: 'ts-commons-http',
    namespace: 'default',
    podSelector: { app: 'ts-commons' },
    port: 3000,
  };

  it('sets apiVersion policy.linkerd.io/v1beta3', () => {
    const s = buildServer(base) as any;
    expect(s.apiVersion).toBe('policy.linkerd.io/v1beta3');
  });

  it('sets kind Server', () => {
    const s = buildServer(base) as any;
    expect(s.kind).toBe('Server');
  });

  it('sets metadata name and namespace', () => {
    const s = buildServer(base) as any;
    expect(s.metadata.name).toBe('ts-commons-http');
    expect(s.metadata.namespace).toBe('default');
  });

  it('sets podSelector matchLabels', () => {
    const s = buildServer(base) as any;
    expect(s.spec.podSelector.matchLabels.app).toBe('ts-commons');
  });

  it('sets port', () => {
    const s = buildServer(base) as any;
    expect(s.spec.port).toBe(3000);
  });

  it('omits proxyProtocol when not provided', () => {
    const s = buildServer(base) as any;
    expect(s.spec.proxyProtocol).toBeUndefined();
  });

  it('sets proxyProtocol HTTP/1', () => {
    const s = buildServer({ ...base, proxyProtocol: 'HTTP/1' }) as any;
    expect(s.spec.proxyProtocol).toBe('HTTP/1');
  });

  it('sets proxyProtocol gRPC', () => {
    const s = buildServer({ ...base, proxyProtocol: 'gRPC' }) as any;
    expect(s.spec.proxyProtocol).toBe('gRPC');
  });

  it('supports multiple pod selector labels', () => {
    const s = buildServer({ ...base, podSelector: { app: 'ts-commons', tier: 'backend' } }) as any;
    expect(s.spec.podSelector.matchLabels.tier).toBe('backend');
  });
});

describe('buildServerAuthorization', () => {
  const base: LinkerdAuthorizationConfig = {
    name: 'allow-internal',
    namespace: 'default',
    serverName: 'ts-commons-http',
  };

  it('sets apiVersion policy.linkerd.io/v1beta3', () => {
    const sa = buildServerAuthorization(base) as any;
    expect(sa.apiVersion).toBe('policy.linkerd.io/v1beta3');
  });

  it('sets kind ServerAuthorization', () => {
    const sa = buildServerAuthorization(base) as any;
    expect(sa.kind).toBe('ServerAuthorization');
  });

  it('sets metadata name and namespace', () => {
    const sa = buildServerAuthorization(base) as any;
    expect(sa.metadata.name).toBe('allow-internal');
    expect(sa.metadata.namespace).toBe('default');
  });

  it('sets server name in spec', () => {
    const sa = buildServerAuthorization(base) as any;
    expect(sa.spec.server.name).toBe('ts-commons-http');
  });

  it('includes service accounts when provided', () => {
    const config: LinkerdAuthorizationConfig = {
      ...base,
      allowedServiceAccounts: [{ name: 'api-gw', namespace: 'default' }],
    };
    const sa = buildServerAuthorization(config) as any;
    expect(sa.spec.client.meshTLS.serviceAccounts[0].name).toBe('api-gw');
  });

  it('includes service account namespace', () => {
    const config: LinkerdAuthorizationConfig = {
      ...base,
      allowedServiceAccounts: [{ name: 'worker', namespace: 'jobs' }],
    };
    const sa = buildServerAuthorization(config) as any;
    expect(sa.spec.client.meshTLS.serviceAccounts[0].namespace).toBe('jobs');
  });

  it('has empty meshTLS when no service accounts', () => {
    const sa = buildServerAuthorization(base) as any;
    expect(sa.spec.client.meshTLS).toEqual({});
  });
});

// ── ServiceMeshValidator ──────────────────────────────────────────────────────

describe('validateRetryPolicy', () => {
  it('returns valid for a correct policy', () => {
    const r = validateRetryPolicy(makeRetry());
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('errors when attempts < 1', () => {
    const r = validateRetryPolicy(makeRetry({ attempts: 0 }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('>= 1'))).toBe(true);
  });

  it('errors when attempts > 10', () => {
    const r = validateRetryPolicy(makeRetry({ attempts: 11 }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('<= 10'))).toBe(true);
  });

  it('accepts attempts = 10 (boundary)', () => {
    const r = validateRetryPolicy(makeRetry({ attempts: 10 }));
    expect(r.valid).toBe(true);
  });

  it('errors on invalid duration format', () => {
    const r = validateRetryPolicy(makeRetry({ perTryTimeout: '2seconds' }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('duration'))).toBe(true);
  });

  it('accepts millisecond duration', () => {
    const r = validateRetryPolicy(makeRetry({ perTryTimeout: '500ms' }));
    expect(r.valid).toBe(true);
  });

  it('errors when retryOn is empty', () => {
    const r = validateRetryPolicy(makeRetry({ retryOn: '  ' }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('retryOn'))).toBe(true);
  });
});

describe('validateCircuitBreaker', () => {
  it('returns valid for correct config', () => {
    const cb: CircuitBreakerConfig = {
      consecutive5xxErrors: 5,
      interval: '30s',
      baseEjectionTime: '30s',
      maxEjectionPercent: 50,
    };
    const r = validateCircuitBreaker(cb);
    expect(r.valid).toBe(true);
  });

  it('errors when consecutive threshold < 1', () => {
    const r = validateCircuitBreaker({ consecutive5xxErrors: 0 });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('threshold'))).toBe(true);
  });

  it('errors when maxEjectionPercent > 100', () => {
    const r = validateCircuitBreaker({ maxEjectionPercent: 101 });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('maxEjectionPercent'))).toBe(true);
  });

  it('errors when maxEjectionPercent < 0', () => {
    const r = validateCircuitBreaker({ maxEjectionPercent: -1 });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('maxEjectionPercent'))).toBe(true);
  });

  it('errors on invalid interval duration', () => {
    const r = validateCircuitBreaker({ interval: '30seconds' });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('interval'))).toBe(true);
  });

  it('errors on invalid baseEjectionTime duration', () => {
    const r = validateCircuitBreaker({ baseEjectionTime: 'thirty-seconds' });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('baseEjectionTime'))).toBe(true);
  });

  it('accepts empty config (all optional)', () => {
    const r = validateCircuitBreaker({});
    expect(r.valid).toBe(true);
  });
});

describe('validateVirtualService', () => {
  it('returns valid for correct config', () => {
    const r = validateVirtualService(makeVSConfig());
    expect(r.valid).toBe(true);
  });

  it('errors on name with uppercase', () => {
    const r = validateVirtualService(makeVSConfig({ name: 'MyService' }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('name'))).toBe(true);
  });

  it('errors on empty hosts array', () => {
    const r = validateVirtualService(makeVSConfig({ hosts: [] }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('hosts'))).toBe(true);
  });

  it('errors on empty routes array', () => {
    const r = validateVirtualService(makeVSConfig({ routes: [] }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('routes'))).toBe(true);
  });

  it('errors on invalid timeout duration', () => {
    const r = validateVirtualService(makeVSConfig({ timeout: 'ten-seconds' }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('timeout'))).toBe(true);
  });

  it('propagates retry policy errors', () => {
    const r = validateVirtualService(makeVSConfig({ retryPolicy: makeRetry({ attempts: 0 }) }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('>= 1'))).toBe(true);
  });

  it('errors when route weights do not sum to 100', () => {
    const config = makeVSConfig({
      routes: [
        { host: 'v1', port: 3000, weight: 60 },
        { host: 'v2', port: 3000, weight: 20 },
      ],
    });
    const r = validateVirtualService(config);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('weights'))).toBe(true);
  });

  it('accepts route weights summing to 100', () => {
    const config = makeVSConfig({
      routes: [
        { host: 'v1', port: 3000, weight: 80 },
        { host: 'v2', port: 3000, weight: 20 },
      ],
    });
    const r = validateVirtualService(config);
    expect(r.valid).toBe(true);
  });
});

describe('validateDestinationRule', () => {
  it('returns valid for correct config', () => {
    const r = validateDestinationRule(makeDRConfig());
    expect(r.valid).toBe(true);
  });

  it('errors on invalid name', () => {
    const r = validateDestinationRule(makeDRConfig({ name: 'My_Service' }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('name'))).toBe(true);
  });

  it('errors on empty host', () => {
    const r = validateDestinationRule(makeDRConfig({ host: '  ' }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('host'))).toBe(true);
  });

  it('propagates circuit breaker errors', () => {
    const r = validateDestinationRule(
      makeDRConfig({ circuitBreaker: { consecutive5xxErrors: 0 } }),
    );
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('threshold'))).toBe(true);
  });

  it('accepts valid config with circuit breaker', () => {
    const r = validateDestinationRule(
      makeDRConfig({ circuitBreaker: { consecutive5xxErrors: 5, maxEjectionPercent: 50 } }),
    );
    expect(r.valid).toBe(true);
  });
});
