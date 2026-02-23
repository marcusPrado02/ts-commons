import type { HPAOptions, K8sManifestBase } from '../types';

const CPU_METRIC = (utilization: number): Record<string, unknown> => ({
  type: 'Resource',
  resource: {
    name: 'cpu',
    target: { type: 'Utilization', averageUtilization: utilization },
  },
});

const MEMORY_METRIC = (utilization: number): Record<string, unknown> => ({
  type: 'Resource',
  resource: {
    name: 'memory',
    target: { type: 'Utilization', averageUtilization: utilization },
  },
});

export function buildHPA(opts: HPAOptions): K8sManifestBase & Record<string, unknown> {
  const metrics: unknown[] = [CPU_METRIC(opts.cpuUtilization)];
  if (opts.memoryUtilization !== undefined) {
    metrics.push(MEMORY_METRIC(opts.memoryUtilization));
  }
  return {
    apiVersion: 'autoscaling/v2',
    kind: 'HorizontalPodAutoscaler',
    metadata: {
      name: opts.metadata.name,
      namespace: opts.metadata.namespace,
      labels: opts.metadata.labels,
      annotations: opts.metadata.annotations,
    },
    spec: {
      scaleTargetRef: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        name: opts.targetName,
      },
      minReplicas: opts.minReplicas,
      maxReplicas: opts.maxReplicas,
      metrics,
    },
  };
}
