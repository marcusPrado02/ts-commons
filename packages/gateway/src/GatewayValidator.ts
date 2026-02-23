import type {
  RateLimitConfig,
  ApiKeyConfig,
  GatewayRouteConfig,
  ResponseCacheConfig,
  GatewayValidationResult,
} from './types';

const HEADER_NAME_REGEX = /^[A-Za-z][A-Za-z0-9-]*$/;

function ok(): GatewayValidationResult {
  return { valid: true, errors: [] };
}

function fail(errors: string[]): GatewayValidationResult {
  return { valid: false, errors };
}

function hasAtLeastOneLimit(config: RateLimitConfig): boolean {
  return (
    config.requestsPerSecond !== undefined ||
    config.requestsPerMinute !== undefined ||
    config.requestsPerHour !== undefined ||
    config.requestsPerDay !== undefined
  );
}

function validateLimitValues(config: RateLimitConfig): string[] {
  const errors: string[] = [];
  const limits = [
    config.requestsPerSecond,
    config.requestsPerMinute,
    config.requestsPerHour,
    config.requestsPerDay,
  ];
  for (const limit of limits) {
    if (limit !== undefined && limit < 1) {
      errors.push('rate limit values must be >= 1');
      break;
    }
  }
  return errors;
}

export function validateRateLimit(config: RateLimitConfig): GatewayValidationResult {
  const errors: string[] = [];
  if (!hasAtLeastOneLimit(config)) {
    errors.push('at least one rate limit (second/minute/hour/day) must be set');
  }
  errors.push(...validateLimitValues(config));
  return errors.length === 0 ? ok() : fail(errors);
}

export function validateApiKey(config: ApiKeyConfig): GatewayValidationResult {
  const errors: string[] = [];
  if (config.headerName.trim().length === 0) {
    errors.push('headerName must not be empty');
  }
  if (!HEADER_NAME_REGEX.test(config.headerName)) {
    errors.push(
      'headerName must start with a letter and contain only letters, digits, and hyphens',
    );
  }
  if (config.expireTtlSeconds !== undefined && config.expireTtlSeconds < 0) {
    errors.push('expireTtlSeconds must be >= 0');
  }
  return errors.length === 0 ? ok() : fail(errors);
}

export function validateCacheConfig(config: ResponseCacheConfig): GatewayValidationResult {
  const errors: string[] = [];
  if (config.ttlSeconds <= 0) errors.push('ttlSeconds must be > 0');
  if (config.ttlSeconds > 86400) errors.push('ttlSeconds must be <= 86400 (24 h)');
  return errors.length === 0 ? ok() : fail(errors);
}

function validateRouteName(name: string): string[] {
  return /^[a-z][a-z0-9-]*$/.test(name) ? [] : ['route name must match [a-z][a-z0-9-]*'];
}

function validateSubConfigs(route: GatewayRouteConfig): string[] {
  const errors: string[] = [];
  if (route.rateLimit !== undefined) errors.push(...validateRateLimit(route.rateLimit).errors);
  if (route.apiKey !== undefined) errors.push(...validateApiKey(route.apiKey).errors);
  if (route.responseCache !== undefined)
    errors.push(...validateCacheConfig(route.responseCache).errors);
  return errors;
}

export function validateRouteConfig(route: GatewayRouteConfig): GatewayValidationResult {
  const errors: string[] = [];
  errors.push(...validateRouteName(route.name));
  if (route.paths.length === 0) errors.push('paths must not be empty');
  for (const path of route.paths) {
    if (!path.startsWith('/')) errors.push(`path "${path}" must start with /`);
  }
  errors.push(...validateSubConfigs(route));
  return errors.length === 0 ? ok() : fail(errors);
}
