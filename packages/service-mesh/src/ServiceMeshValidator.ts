import type {
  RetryPolicy,
  CircuitBreakerConfig,
  VirtualServiceConfig,
  DestinationRuleConfig,
  ServiceMeshValidationResult,
} from './types';

const NAME_REGEX = /^[a-z][a-z0-9-]*$/;
const DURATION_REGEX = /^\d+(\.\d+)?(ms|s|m|h)$/;

function ok(): ServiceMeshValidationResult {
  return { valid: true, errors: [] };
}

function fail(errors: string[]): ServiceMeshValidationResult {
  return { valid: false, errors };
}

export function validateRetryPolicy(policy: RetryPolicy): ServiceMeshValidationResult {
  const errors: string[] = [];
  if (policy.attempts < 1) errors.push('attempts must be >= 1');
  if (policy.attempts > 10) errors.push('attempts must be <= 10');
  if (!DURATION_REGEX.test(policy.perTryTimeout)) {
    errors.push('perTryTimeout must be a valid duration (e.g. 500ms, 2s)');
  }
  if (policy.retryOn.trim().length === 0) errors.push('retryOn must not be empty');
  return errors.length === 0 ? ok() : fail(errors);
}

function validateCbDurations(config: CircuitBreakerConfig): string[] {
  const errors: string[] = [];
  if (config.interval !== undefined && !DURATION_REGEX.test(config.interval)) {
    errors.push('interval must be a valid duration (e.g. 30s, 1m)');
  }
  if (config.baseEjectionTime !== undefined && !DURATION_REGEX.test(config.baseEjectionTime)) {
    errors.push('baseEjectionTime must be a valid duration (e.g. 30s, 1m)');
  }
  return errors;
}

export function validateCircuitBreaker(config: CircuitBreakerConfig): ServiceMeshValidationResult {
  const errors: string[] = [];
  const threshold = config.consecutiveGatewayErrors ?? config.consecutive5xxErrors;
  if (threshold !== undefined) {
    if (threshold < 1) errors.push('consecutive error threshold must be >= 1');
  }
  if (config.maxEjectionPercent !== undefined) {
    if (config.maxEjectionPercent < 0 || config.maxEjectionPercent > 100) {
      errors.push('maxEjectionPercent must be between 0 and 100');
    }
  }
  errors.push(...validateCbDurations(config));
  return errors.length === 0 ? ok() : fail(errors);
}

function validateRouteWeights(config: VirtualServiceConfig): string[] {
  const withWeight = config.routes.filter((r) => r.weight !== undefined);
  if (withWeight.length === 0) return [];
  const sum = withWeight.reduce((acc, r) => acc + (r.weight ?? 0), 0);
  return sum === 100 ? [] : ['route weights must sum to 100 when specified'];
}

export function validateVirtualService(config: VirtualServiceConfig): ServiceMeshValidationResult {
  const errors: string[] = [];
  if (!NAME_REGEX.test(config.name)) errors.push('name must match [a-z][a-z0-9-]*');
  if (config.hosts.length === 0) errors.push('hosts must not be empty');
  if (config.routes.length === 0) errors.push('routes must not be empty');
  if (config.timeout !== undefined && !DURATION_REGEX.test(config.timeout)) {
    errors.push('timeout must be a valid duration (e.g. 10s, 500ms)');
  }
  if (config.retryPolicy !== undefined) {
    const r = validateRetryPolicy(config.retryPolicy);
    errors.push(...r.errors);
  }
  errors.push(...validateRouteWeights(config));
  return errors.length === 0 ? ok() : fail(errors);
}

export function validateDestinationRule(
  config: DestinationRuleConfig,
): ServiceMeshValidationResult {
  const errors: string[] = [];
  if (!NAME_REGEX.test(config.name)) errors.push('name must match [a-z][a-z0-9-]*');
  if (config.host.trim().length === 0) errors.push('host must not be empty');
  if (config.circuitBreaker !== undefined) {
    const r = validateCircuitBreaker(config.circuitBreaker);
    errors.push(...r.errors);
  }
  return errors.length === 0 ? ok() : fail(errors);
}
