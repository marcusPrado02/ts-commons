import type {
  VirtualServiceConfig,
  DestinationRuleConfig,
  PeerAuthenticationConfig,
  RetryPolicy,
  CircuitBreakerConfig,
  ConnectionPoolConfig,
  VirtualServiceRoute,
} from './types';

function buildRetrySpec(retry: RetryPolicy): Record<string, unknown> {
  return {
    attempts: retry.attempts,
    perTryTimeout: retry.perTryTimeout,
    retryOn: retry.retryOn,
  };
}

function buildRouteDestination(route: VirtualServiceRoute): Record<string, unknown> {
  const dest: Record<string, unknown> = {
    destination: { host: route.host, port: { number: route.port } },
  };
  if (route.weight !== undefined) {
    dest['weight'] = route.weight;
  }
  return dest;
}

function buildHttpSpec(config: VirtualServiceConfig): Record<string, unknown> {
  const http: Record<string, unknown> = {
    route: config.routes.map(buildRouteDestination),
  };
  if (config.timeout !== undefined) {
    http['timeout'] = config.timeout;
  }
  if (config.retryPolicy !== undefined) {
    http['retries'] = buildRetrySpec(config.retryPolicy);
  }
  return http;
}

export function buildVirtualService(config: VirtualServiceConfig): unknown {
  const spec: Record<string, unknown> = {
    hosts: config.hosts,
    http: [buildHttpSpec(config)],
  };
  if (config.gateways !== undefined) {
    spec['gateways'] = config.gateways;
  }
  return {
    apiVersion: 'networking.istio.io/v1beta1',
    kind: 'VirtualService',
    metadata: { name: config.name, namespace: config.namespace },
    spec,
  };
}

function buildOutlierDetection(cb: CircuitBreakerConfig): Record<string, unknown> {
  const od: Record<string, unknown> = {};
  if (cb.consecutiveGatewayErrors !== undefined) {
    od['consecutiveGatewayErrors'] = cb.consecutiveGatewayErrors;
  }
  if (cb.consecutive5xxErrors !== undefined) {
    od['consecutive5xxErrors'] = cb.consecutive5xxErrors;
  }
  if (cb.interval !== undefined) od['interval'] = cb.interval;
  if (cb.baseEjectionTime !== undefined) od['baseEjectionTime'] = cb.baseEjectionTime;
  if (cb.maxEjectionPercent !== undefined) od['maxEjectionPercent'] = cb.maxEjectionPercent;
  return od;
}

function buildConnectionPool(cp: ConnectionPoolConfig): Record<string, unknown> {
  const pool: Record<string, unknown> = {};
  const http: Record<string, unknown> = {};
  if (cp.http1MaxPendingRequests !== undefined) {
    http['http1MaxPendingRequests'] = cp.http1MaxPendingRequests;
  }
  if (cp.http2MaxRequests !== undefined) {
    http['http2MaxRequests'] = cp.http2MaxRequests;
  }
  if (Object.keys(http).length > 0) pool['http'] = http;
  if (cp.maxConnectionsPerHost !== undefined) {
    pool['tcp'] = { maxConnections: cp.maxConnectionsPerHost };
  }
  return pool;
}

function buildTrafficPolicy(config: DestinationRuleConfig): Record<string, unknown> {
  const tp: Record<string, unknown> = { tls: { mode: config.mtlsMode } };
  if (config.loadBalancingPolicy !== undefined) {
    tp['loadBalancer'] = { simple: config.loadBalancingPolicy };
  }
  if (config.circuitBreaker !== undefined) {
    tp['outlierDetection'] = buildOutlierDetection(config.circuitBreaker);
  }
  if (config.connectionPool !== undefined) {
    tp['connectionPool'] = buildConnectionPool(config.connectionPool);
  }
  return tp;
}

export function buildDestinationRule(config: DestinationRuleConfig): unknown {
  return {
    apiVersion: 'networking.istio.io/v1beta1',
    kind: 'DestinationRule',
    metadata: { name: config.name, namespace: config.namespace },
    spec: {
      host: config.host,
      trafficPolicy: buildTrafficPolicy(config),
    },
  };
}

function buildPortLevelMtls(portLevelMtls: Record<string, string>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(portLevelMtls).map(([port, mode]) => [port, { mode }]));
}

export function buildPeerAuthentication(config: PeerAuthenticationConfig): unknown {
  const spec: Record<string, unknown> = { mtls: { mode: config.mtlsMode } };
  if (config.portLevelMtls !== undefined) {
    spec['portLevelMtls'] = buildPortLevelMtls(config.portLevelMtls);
  }
  return {
    apiVersion: 'security.istio.io/v1beta1',
    kind: 'PeerAuthentication',
    metadata: { name: config.name, namespace: config.namespace },
    spec,
  };
}
