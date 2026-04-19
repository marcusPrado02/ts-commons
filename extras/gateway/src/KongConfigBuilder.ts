import type {
  GatewayServiceConfig,
  GatewayRouteConfig,
  RateLimitConfig,
  ApiKeyConfig,
  RequestTransform,
} from './types';

function buildRateLimitPlugin(config: RateLimitConfig): Record<string, unknown> {
  return {
    name: 'rate-limiting',
    config: {
      second: config.requestsPerSecond ?? null,
      minute: config.requestsPerMinute ?? null,
      hour: config.requestsPerHour ?? null,
      day: config.requestsPerDay ?? null,
      policy: config.byIp === true ? 'local' : 'cluster',
      fault_tolerant: true,
      hide_client_headers: false,
    },
  };
}

function buildKeyAuthPlugin(config: ApiKeyConfig): Record<string, unknown> {
  return {
    name: 'key-auth',
    config: {
      key_names: [config.headerName],
      key_in_header: true,
      key_in_query: false,
      key_in_body: false,
      hide_credentials: config.hideCredentials ?? true,
    },
  };
}

function buildRequestTransformPlugin(transform: RequestTransform): Record<string, unknown> {
  const addHeaders = Object.entries(transform.addHeaders ?? {}).map(([k, v]) => `${k}:${v}`);
  return {
    name: 'request-transformer',
    config: {
      add: {
        headers: addHeaders,
        querystring: Object.entries(transform.addQueryParams ?? {}).map(([k, v]) => `${k}:${v}`),
      },
      remove: {
        headers: transform.removeHeaders ?? [],
        querystring: transform.removeQueryParams ?? [],
      },
    },
  };
}

function collectRoutePlugins(route: GatewayRouteConfig): Record<string, unknown>[] {
  const plugins: Record<string, unknown>[] = [];
  if (route.rateLimit !== undefined) plugins.push(buildRateLimitPlugin(route.rateLimit));
  if (route.apiKey !== undefined) plugins.push(buildKeyAuthPlugin(route.apiKey));
  if (route.requestTransform !== undefined)
    plugins.push(buildRequestTransformPlugin(route.requestTransform));
  return plugins;
}

function buildRoute(route: GatewayRouteConfig): Record<string, unknown> {
  const r: Record<string, unknown> = {
    name: route.name,
    paths: route.paths,
    strip_path: route.stripPath ?? true,
    preserve_host: route.preserveHost ?? false,
    plugins: collectRoutePlugins(route),
  };
  if (route.methods !== undefined) r['methods'] = route.methods;
  return r;
}

export function buildKongService(config: GatewayServiceConfig): unknown {
  return {
    name: config.name,
    url: config.url,
    connect_timeout: config.connectTimeout ?? 60000,
    read_timeout: config.readTimeout ?? 60000,
    write_timeout: config.writeTimeout ?? 60000,
    retries: config.retries ?? 5,
    routes: config.routes.map(buildRoute),
  };
}

export function buildKongRateLimitPlugin(config: RateLimitConfig): unknown {
  return buildRateLimitPlugin(config);
}

export function buildKongKeyAuthPlugin(config: ApiKeyConfig): unknown {
  return buildKeyAuthPlugin(config);
}

export function buildKongRequestTransformPlugin(transform: RequestTransform): unknown {
  return buildRequestTransformPlugin(transform);
}
