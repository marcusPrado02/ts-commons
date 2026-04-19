// ── Shared types ─────────────────────────────────────────────────────────────

export interface K8sMetadata {
  name: string;
  namespace: string;
  labels: Record<string, string>;
  annotations: Record<string, string> | undefined;
}

export interface ResourceLimits {
  cpu: string;
  memory: string;
}

export interface ResourceRequirements {
  requests: ResourceLimits | undefined;
  limits: ResourceLimits | undefined;
}

export interface HttpProbe {
  path: string;
  port: number | string;
  initialDelaySeconds: number;
  periodSeconds: number;
  timeoutSeconds: number;
  failureThreshold: number;
}

export interface ContainerPort {
  name: string;
  containerPort: number;
  protocol: 'TCP' | 'UDP';
}

export interface EnvVarSource {
  configMapKeyRef: { name: string; key: string } | undefined;
  secretKeyRef: { name: string; key: string } | undefined;
}

export interface EnvVar {
  name: string;
  value: string | undefined;
  valueFrom: EnvVarSource | undefined;
}

export interface ContainerSpec {
  name: string;
  image: string;
  ports: ContainerPort[];
  env: EnvVar[];
  resources: ResourceRequirements | undefined;
  livenessProbe: HttpProbe | undefined;
  readinessProbe: HttpProbe | undefined;
}

// ── Deployment ────────────────────────────────────────────────────────────────

export interface DeploymentOptions {
  metadata: K8sMetadata;
  replicas: number;
  containers: ContainerSpec[];
  serviceAccountName: string | undefined;
}

// ── Service ───────────────────────────────────────────────────────────────────

export type ServiceType = 'ClusterIP' | 'NodePort' | 'LoadBalancer';

export interface ServicePort {
  name: string;
  port: number;
  targetPort: number | string;
  protocol: 'TCP' | 'UDP';
}

export interface ServiceOptions {
  metadata: K8sMetadata;
  selector: Record<string, string>;
  ports: ServicePort[];
  type: ServiceType;
}

// ── ConfigMap ─────────────────────────────────────────────────────────────────

export interface ConfigMapOptions {
  metadata: K8sMetadata;
  data: Record<string, string>;
}

// ── HPA ───────────────────────────────────────────────────────────────────────

export interface HPAOptions {
  metadata: K8sMetadata;
  targetName: string;
  minReplicas: number;
  maxReplicas: number;
  cpuUtilization: number;
  memoryUtilization: number | undefined;
}

// ── PDB ───────────────────────────────────────────────────────────────────────

export interface PDBOptions {
  metadata: K8sMetadata;
  selector: Record<string, string>;
  minAvailable: number | undefined;
  maxUnavailable: number | undefined;
}

// ── NetworkPolicy ─────────────────────────────────────────────────────────────

export interface NetworkPolicyOptions {
  metadata: K8sMetadata;
  podSelector: Record<string, string>;
  allowIngressFromNamespace: string | undefined;
  allowPorts: number[];
}

// ── Ingress ───────────────────────────────────────────────────────────────────

export interface IngressPath {
  path: string;
  pathType: 'Prefix' | 'Exact' | 'ImplementationSpecific';
  serviceName: string;
  servicePort: number | string;
}

export interface IngressOptions {
  metadata: K8sMetadata;
  ingressClassName: string;
  host: string;
  paths: IngressPath[];
  tlsSecretName: string | undefined;
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ── Generic manifest envelope ─────────────────────────────────────────────────

export interface K8sManifestBase {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace: string;
    labels: Record<string, string> | undefined;
    annotations: Record<string, string> | undefined;
  };
}
