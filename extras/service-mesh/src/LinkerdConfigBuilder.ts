import type { LinkerdServerConfig, LinkerdAuthorizationConfig, ServiceAccount } from './types';

export function buildServer(config: LinkerdServerConfig): unknown {
  const spec: Record<string, unknown> = {
    podSelector: { matchLabels: config.podSelector },
    port: config.port,
  };
  if (config.proxyProtocol !== undefined) {
    spec['proxyProtocol'] = config.proxyProtocol;
  }
  return {
    apiVersion: 'policy.linkerd.io/v1beta3',
    kind: 'Server',
    metadata: { name: config.name, namespace: config.namespace },
    spec,
  };
}

function buildMeshTLS(accounts: ServiceAccount[]): Record<string, unknown> {
  return {
    serviceAccounts: accounts.map((sa) => ({
      name: sa.name,
      namespace: sa.namespace,
    })),
  };
}

export function buildServerAuthorization(config: LinkerdAuthorizationConfig): unknown {
  const meshTLS: Record<string, unknown> =
    config.allowedServiceAccounts !== undefined && config.allowedServiceAccounts.length > 0
      ? buildMeshTLS(config.allowedServiceAccounts)
      : {};
  return {
    apiVersion: 'policy.linkerd.io/v1beta3',
    kind: 'ServerAuthorization',
    metadata: { name: config.name, namespace: config.namespace },
    spec: {
      server: { name: config.serverName },
      client: { meshTLS },
    },
  };
}
