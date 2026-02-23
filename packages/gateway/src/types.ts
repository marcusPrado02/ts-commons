export type GatewayProvider = 'kong' | 'aws' | 'azure';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

export type CacheStrategy = 'no-cache' | 'cache-first' | 'stale-while-revalidate';

export type AwsQuotaPeriod = 'DAY' | 'WEEK' | 'MONTH';

export interface RateLimitConfig {
  requestsPerSecond?: number;
  requestsPerMinute?: number;
  requestsPerHour?: number;
  requestsPerDay?: number;
  byConsumer?: boolean;
  byIp?: boolean;
}

export interface ApiKeyConfig {
  headerName: string;
  keyPrefix?: string;
  expireTtlSeconds?: number;
  hideCredentials?: boolean;
}

export interface RequestTransform {
  addHeaders?: Record<string, string>;
  removeHeaders?: string[];
  addQueryParams?: Record<string, string>;
  removeQueryParams?: string[];
}

export interface ResponseCacheConfig {
  strategy: CacheStrategy;
  ttlSeconds: number;
  varyByHeaders?: string[];
  varyByQueryParams?: string[];
}

export interface GatewayRouteConfig {
  name: string;
  paths: string[];
  methods?: HttpMethod[];
  stripPath?: boolean;
  preserveHost?: boolean;
  rateLimit?: RateLimitConfig;
  apiKey?: ApiKeyConfig;
  requestTransform?: RequestTransform;
  responseCache?: ResponseCacheConfig;
}

export interface GatewayServiceConfig {
  name: string;
  url: string;
  routes: GatewayRouteConfig[];
  connectTimeout?: number;
  readTimeout?: number;
  writeTimeout?: number;
  retries?: number;
}

export interface AwsApiConfig {
  name: string;
  description?: string;
  stageName: string;
  usagePlanName: string;
  throttlingRateLimit?: number;
  throttlingBurstLimit?: number;
  quotaLimit?: number;
  quotaPeriod?: AwsQuotaPeriod;
}

export interface AzureApimConfig {
  serviceName: string;
  apiName: string;
  path: string;
  productName: string;
  rateLimit?: RateLimitConfig;
  responseCache?: ResponseCacheConfig;
}

export interface GatewayValidationResult {
  valid: boolean;
  errors: string[];
}
