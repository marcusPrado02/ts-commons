import type {
  HelmValues,
  HelmImage,
  HelmResources,
  HelmAutoscaling,
  HelmIngress,
  HelmPDB,
} from './types';

const DEFAULT_PROBE = {
  path: '/healthz',
  port: 3000,
  initialDelaySeconds: 10,
  periodSeconds: 10,
  timeoutSeconds: 5,
  failureThreshold: 3,
};

function buildDefaultValues(): HelmValues {
  return {
    replicaCount: 1,
    image: { repository: 'acme/app', tag: 'latest', pullPolicy: 'IfNotPresent' },
    serviceAccount: { create: true, name: '', annotations: {} },
    service: { type: 'ClusterIP', port: 80, targetPort: 3000, annotations: {} },
    resources: {
      requests: { cpu: '100m', memory: '128Mi' },
      limits: { cpu: '500m', memory: '512Mi' },
    },
    livenessProbe: { ...DEFAULT_PROBE },
    readinessProbe: { ...DEFAULT_PROBE, path: '/readyz' },
    autoscaling: {
      enabled: false,
      minReplicas: 1,
      maxReplicas: 10,
      targetCPUUtilizationPercentage: 70,
      targetMemoryUtilizationPercentage: undefined,
    },
    podDisruptionBudget: { enabled: false, minAvailable: 1, maxUnavailable: undefined },
    ingress: {
      enabled: false,
      className: 'nginx',
      annotations: {},
      host: 'example.com',
      paths: [{ path: '/', pathType: 'Prefix' }],
      tls: { enabled: false, secretName: '' },
    },
    networkPolicy: { enabled: false, allowIngressFromNamespace: 'default' },
    env: {},
    config: {},
    terminationGracePeriodSeconds: 30,
  };
}

export class ValuesBuilder {
  private readonly values: HelmValues;

  constructor(base: Partial<HelmValues> = {}) {
    this.values = { ...buildDefaultValues(), ...base };
  }

  setImage(image: Partial<HelmImage>): this {
    this.values.image = { ...this.values.image, ...image };
    return this;
  }

  setReplicas(count: number): this {
    this.values.replicaCount = count;
    return this;
  }

  setResources(resources: Partial<HelmResources>): this {
    this.values.resources = { ...this.values.resources, ...resources };
    return this;
  }

  setAutoscaling(config: Partial<HelmAutoscaling>): this {
    this.values.autoscaling = { ...this.values.autoscaling, ...config };
    return this;
  }

  setIngress(config: Partial<HelmIngress>): this {
    this.values.ingress = { ...this.values.ingress, ...config };
    return this;
  }

  enablePDB(config: Partial<HelmPDB>): this {
    this.values.podDisruptionBudget = {
      ...this.values.podDisruptionBudget,
      ...config,
      enabled: true,
    };
    return this;
  }

  setEnv(env: Record<string, string>): this {
    this.values.env = { ...this.values.env, ...env };
    return this;
  }

  setConfig(config: Record<string, string>): this {
    this.values.config = { ...this.values.config, ...config };
    return this;
  }

  setTerminationGracePeriod(seconds: number): this {
    this.values.terminationGracePeriodSeconds = seconds;
    return this;
  }

  build(): HelmValues {
    return structuredClone(this.values);
  }
}
