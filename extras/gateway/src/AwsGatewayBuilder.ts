import type { AwsApiConfig } from './types';

export function buildRestApiSpec(config: AwsApiConfig): unknown {
  return {
    name: config.name,
    description: config.description ?? '',
    endpoint_configuration: {
      types: ['REGIONAL'],
    },
    tags: {
      Stage: config.stageName,
    },
  };
}

function buildThrottle(config: AwsApiConfig): Record<string, unknown> | undefined {
  if (config.throttlingRateLimit === undefined && config.throttlingBurstLimit === undefined) {
    return undefined;
  }
  return {
    rate_limit: config.throttlingRateLimit ?? 100,
    burst_limit: config.throttlingBurstLimit ?? 200,
  };
}

function buildQuota(config: AwsApiConfig): Record<string, unknown> | undefined {
  if (config.quotaLimit === undefined) return undefined;
  return {
    limit: config.quotaLimit,
    period: config.quotaPeriod ?? 'DAY',
  };
}

export function buildUsagePlan(config: AwsApiConfig): unknown {
  const plan: Record<string, unknown> = {
    name: config.usagePlanName,
    api_stages: [
      {
        api_id: config.name,
        stage: config.stageName,
      },
    ],
  };
  const throttle = buildThrottle(config);
  if (throttle !== undefined) plan['throttle'] = throttle;
  const quota = buildQuota(config);
  if (quota !== undefined) plan['quota'] = quota;
  return plan;
}

export function buildApiKeyResource(name: string, description: string): unknown {
  return {
    name,
    description,
    enabled: true,
  };
}

export function buildStageConfig(config: AwsApiConfig): unknown {
  return {
    stage_name: config.stageName,
    variables: {
      api: config.name,
    },
    default_route_settings: {
      throttling_rate_limit: config.throttlingRateLimit ?? 100,
      throttling_burst_limit: config.throttlingBurstLimit ?? 200,
    },
  };
}
