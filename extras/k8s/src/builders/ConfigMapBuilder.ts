import type { ConfigMapOptions, K8sManifestBase } from '../types';

export function buildConfigMap(opts: ConfigMapOptions): K8sManifestBase & Record<string, unknown> {
  return {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: {
      name: opts.metadata.name,
      namespace: opts.metadata.namespace,
      labels: opts.metadata.labels,
      annotations: opts.metadata.annotations,
    },
    data: opts.data,
  };
}
