export interface HelmImage {
  repository: string;
  tag: string;
  pullPolicy: 'Always' | 'IfNotPresent' | 'Never';
}

export interface HelmResources {
  requests: { cpu: string; memory: string };
  limits: { cpu: string; memory: string };
}

export interface HelmProbe {
  path: string;
  port: number;
  initialDelaySeconds: number;
  periodSeconds: number;
  timeoutSeconds: number;
  failureThreshold: number;
}

export interface HelmServiceConfig {
  type: 'ClusterIP' | 'NodePort' | 'LoadBalancer';
  port: number;
  targetPort: number;
  annotations: Record<string, string>;
}

export interface HelmAutoscaling {
  enabled: boolean;
  minReplicas: number;
  maxReplicas: number;
  targetCPUUtilizationPercentage: number;
  targetMemoryUtilizationPercentage: number | undefined;
}

export interface HelmIngressPath {
  path: string;
  pathType: 'Prefix' | 'Exact' | 'ImplementationSpecific';
}

export interface HelmIngressTLS {
  enabled: boolean;
  secretName: string;
}

export interface HelmIngress {
  enabled: boolean;
  className: string;
  annotations: Record<string, string>;
  host: string;
  paths: HelmIngressPath[];
  tls: HelmIngressTLS;
}

export interface HelmPDB {
  enabled: boolean;
  minAvailable: number | undefined;
  maxUnavailable: number | undefined;
}

export interface HelmNetworkPolicy {
  enabled: boolean;
  allowIngressFromNamespace: string;
}

export interface HelmValues {
  replicaCount: number;
  image: HelmImage;
  serviceAccount: { create: boolean; name: string; annotations: Record<string, string> };
  service: HelmServiceConfig;
  resources: HelmResources;
  livenessProbe: HelmProbe;
  readinessProbe: HelmProbe;
  autoscaling: HelmAutoscaling;
  podDisruptionBudget: HelmPDB;
  ingress: HelmIngress;
  networkPolicy: HelmNetworkPolicy;
  env: Record<string, string>;
  config: Record<string, string>;
  terminationGracePeriodSeconds: number;
}

export interface HelmRelease {
  name: string;
  chart: string;
  namespace: string;
  valuesFile: string | undefined;
  setValues: Record<string, string>;
  atomic: boolean;
  timeout: string;
  dryRun: boolean;
}

export interface HelmReleaseValidation {
  valid: boolean;
  errors: string[];
}

export type HelmCommand = 'install' | 'upgrade' | 'uninstall' | 'diff' | 'lint' | 'template';
