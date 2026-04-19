import type { PDBOptions, K8sManifestBase } from '../types';

export function buildPDB(opts: PDBOptions): K8sManifestBase & Record<string, unknown> {
  const spec: Record<string, unknown> = {
    selector: { matchLabels: opts.selector },
  };
  if (opts.minAvailable !== undefined) {
    spec['minAvailable'] = opts.minAvailable;
  } else {
    spec['maxUnavailable'] = opts.maxUnavailable ?? 1;
  }
  return {
    apiVersion: 'policy/v1',
    kind: 'PodDisruptionBudget',
    metadata: {
      name: opts.metadata.name,
      namespace: opts.metadata.namespace,
      labels: opts.metadata.labels,
      annotations: opts.metadata.annotations,
    },
    spec,
  };
}
