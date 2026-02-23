import type { AzureApimConfig, RateLimitConfig, ResponseCacheConfig } from './types';

function buildRateLimitPolicyXml(config: RateLimitConfig): string {
  const calls = config.requestsPerMinute ?? config.requestsPerSecond ?? 100;
  const period = config.requestsPerMinute !== undefined ? 60 : 1;
  return `    <rate-limit calls="${calls}" renewal-period="${period}" />`;
}

function buildCacheLookupXml(cache: ResponseCacheConfig): string {
  const vary =
    cache.varyByHeaders !== undefined
      ? cache.varyByHeaders.map((h) => `      <vary-by-header>${h}</vary-by-header>`).join('\n') +
        '\n'
      : '';
  return `    <cache-lookup vary-by-developer="false" vary-by-developer-groups="false">\n${vary}    </cache-lookup>`;
}

function buildCacheStoreXml(cache: ResponseCacheConfig): string {
  return `    <cache-store duration="${cache.ttlSeconds}" />`;
}

function buildInboundPolicies(config: AzureApimConfig): string[] {
  const policies = ['    <base />'];
  if (config.rateLimit !== undefined) policies.push(buildRateLimitPolicyXml(config.rateLimit));
  if (config.responseCache !== undefined) policies.push(buildCacheLookupXml(config.responseCache));
  return policies;
}

function buildOutboundPolicies(config: AzureApimConfig): string[] {
  const policies = ['    <base />'];
  if (config.responseCache !== undefined) policies.push(buildCacheStoreXml(config.responseCache));
  return policies;
}

export function buildApimPolicy(config: AzureApimConfig): string {
  const lines = [
    '<policies>',
    '  <inbound>',
    ...buildInboundPolicies(config),
    '  </inbound>',
    '  <outbound>',
    ...buildOutboundPolicies(config),
    '  </outbound>',
    '</policies>',
  ];
  return lines.join('\n');
}

export function buildProductConfig(config: AzureApimConfig): unknown {
  return {
    display_name: config.productName,
    api_management_name: config.serviceName,
    resource_group_name: config.serviceName,
    published: true,
    subscription_required: true,
    approval_required: false,
    subscriptions_limit: 1,
    terms: '',
  };
}

export function buildApiConfig(config: AzureApimConfig): unknown {
  return {
    name: config.apiName,
    api_management_name: config.serviceName,
    resource_group_name: config.serviceName,
    path: config.path,
    protocols: ['https'],
    revision: '1',
  };
}
