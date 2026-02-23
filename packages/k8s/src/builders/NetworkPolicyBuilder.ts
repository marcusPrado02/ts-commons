import type { NetworkPolicyOptions, K8sManifestBase } from '../types';

function buildIngressRules(opts: NetworkPolicyOptions): unknown[] {
  const portSpecs = opts.allowPorts.map((p) => ({ protocol: 'TCP', port: p }));
  const fromSources: unknown[] = [];
  if (opts.allowIngressFromNamespace !== undefined) {
    fromSources.push({
      namespaceSelector: {
        matchLabels: { 'kubernetes.io/metadata.name': opts.allowIngressFromNamespace },
      },
    });
  }
  if (fromSources.length === 0) {
    return [{ ports: portSpecs }];
  }
  return [{ from: fromSources, ports: portSpecs }];
}

const DNS_EGRESS = {
  ports: [
    { protocol: 'UDP', port: 53 },
    { protocol: 'TCP', port: 53 },
  ],
};

export function buildNetworkPolicy(
  opts: NetworkPolicyOptions,
): K8sManifestBase & Record<string, unknown> {
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'NetworkPolicy',
    metadata: {
      name: opts.metadata.name,
      namespace: opts.metadata.namespace,
      labels: opts.metadata.labels,
      annotations: opts.metadata.annotations,
    },
    spec: {
      podSelector: { matchLabels: opts.podSelector },
      policyTypes: ['Ingress', 'Egress'],
      ingress: buildIngressRules(opts),
      egress: [DNS_EGRESS],
    },
  };
}
