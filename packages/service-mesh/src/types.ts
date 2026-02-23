export type ServiceMeshProvider = 'istio' | 'linkerd';

export type MtlsMode = 'STRICT' | 'PERMISSIVE' | 'DISABLE';

export type LoadBalancingPolicy = 'ROUND_ROBIN' | 'LEAST_CONN' | 'RANDOM' | 'PASSTHROUGH';

export type LinkerdProxyProtocol = 'HTTP/1' | 'HTTP/2' | 'gRPC' | 'opaque' | 'TLS';

export interface RetryPolicy {
  attempts: number;
  perTryTimeout: string;
  retryOn: string;
}

export interface CircuitBreakerConfig {
  consecutiveGatewayErrors?: number;
  consecutive5xxErrors?: number;
  interval?: string;
  baseEjectionTime?: string;
  maxEjectionPercent?: number;
}

export interface ConnectionPoolConfig {
  http1MaxPendingRequests?: number;
  http2MaxRequests?: number;
  maxConnectionsPerHost?: number;
}

export interface VirtualServiceRoute {
  host: string;
  port: number;
  weight?: number;
}

export interface VirtualServiceConfig {
  name: string;
  namespace: string;
  hosts: string[];
  gateways?: string[];
  retryPolicy?: RetryPolicy;
  timeout?: string;
  routes: VirtualServiceRoute[];
}

export interface DestinationRuleConfig {
  name: string;
  namespace: string;
  host: string;
  mtlsMode: MtlsMode;
  loadBalancingPolicy?: LoadBalancingPolicy;
  circuitBreaker?: CircuitBreakerConfig;
  connectionPool?: ConnectionPoolConfig;
}

export interface PeerAuthenticationConfig {
  name: string;
  namespace: string;
  mtlsMode: MtlsMode;
  portLevelMtls?: Record<string, MtlsMode>;
}

export interface ServiceAccount {
  name: string;
  namespace: string;
}

export interface LinkerdServerConfig {
  name: string;
  namespace: string;
  podSelector: Record<string, string>;
  port: number;
  proxyProtocol?: LinkerdProxyProtocol;
}

export interface LinkerdAuthorizationConfig {
  name: string;
  namespace: string;
  serverName: string;
  allowedServiceAccounts?: ServiceAccount[];
}

export interface ServiceMeshValidationResult {
  valid: boolean;
  errors: string[];
}
