import type { ServiceOptions, K8sManifestBase } from '../types';

export function buildService(opts: ServiceOptions): K8sManifestBase & Record<string, unknown> {
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name: opts.metadata.name,
      namespace: opts.metadata.namespace,
      labels: opts.metadata.labels,
      annotations: opts.metadata.annotations,
    },
    spec: {
      type: opts.type,
      selector: opts.selector,
      ports: opts.ports,
    },
  };
}
