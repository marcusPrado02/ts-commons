/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import {
  buildDeployment,
  buildService,
  buildConfigMap,
  buildHPA,
  buildPDB,
  buildNetworkPolicy,
  buildIngress,
  validateDeployment,
  validateService,
  validateHPA,
  validatePDB,
  validateNetworkPolicy,
  validateIngress,
} from './index';
import type {
  DeploymentOptions,
  ServiceOptions,
  ConfigMapOptions,
  HPAOptions,
  PDBOptions,
  NetworkPolicyOptions,
  IngressOptions,
  ContainerSpec,
  K8sMetadata,
} from './types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const meta: K8sMetadata = {
  name: 'my-app',
  namespace: 'default',
  labels: { app: 'my-app' },
  annotations: undefined,
};

const container: ContainerSpec = {
  name: 'app',
  image: 'my-app:1.0.0',
  ports: [{ name: 'http', containerPort: 3000, protocol: 'TCP' }],
  env: [{ name: 'NODE_ENV', value: 'production', valueFrom: undefined }],
  resources: {
    requests: { cpu: '100m', memory: '128Mi' },
    limits: { cpu: '500m', memory: '512Mi' },
  },
  livenessProbe: {
    path: '/healthz',
    port: 3000,
    initialDelaySeconds: 10,
    periodSeconds: 30,
    timeoutSeconds: 5,
    failureThreshold: 3,
  },
  readinessProbe: {
    path: '/readyz',
    port: 3000,
    initialDelaySeconds: 5,
    periodSeconds: 10,
    timeoutSeconds: 3,
    failureThreshold: 3,
  },
};

const deployOpts: DeploymentOptions = {
  metadata: meta,
  replicas: 2,
  containers: [container],
  serviceAccountName: 'my-app',
};

const svcOpts: ServiceOptions = {
  metadata: meta,
  selector: { app: 'my-app' },
  ports: [{ name: 'http', port: 80, targetPort: 3000, protocol: 'TCP' }],
  type: 'ClusterIP',
};

const cmOpts: ConfigMapOptions = {
  metadata: meta,
  data: { LOG_LEVEL: 'info', PORT: '3000' },
};

const hpaOpts: HPAOptions = {
  metadata: { ...meta, name: 'my-app-hpa' },
  targetName: 'my-app',
  minReplicas: 2,
  maxReplicas: 10,
  cpuUtilization: 70,
  memoryUtilization: undefined,
};

const pdbOpts: PDBOptions = {
  metadata: { ...meta, name: 'my-app-pdb' },
  selector: { app: 'my-app' },
  minAvailable: 1,
  maxUnavailable: undefined,
};

const netpolOpts: NetworkPolicyOptions = {
  metadata: { ...meta, name: 'my-app-netpol' },
  podSelector: { app: 'my-app' },
  allowIngressFromNamespace: 'ingress-nginx',
  allowPorts: [3000],
};

const ingressOpts: IngressOptions = {
  metadata: { ...meta, name: 'my-app-ingress' },
  ingressClassName: 'nginx',
  host: 'my-app.example.com',
  paths: [{ path: '/', pathType: 'Prefix', serviceName: 'my-app', servicePort: 80 }],
  tlsSecretName: 'my-app-tls',
};

// ── buildDeployment ───────────────────────────────────────────────────────────

describe('buildDeployment', () => {
  it('sets apiVersion to apps/v1', () => {
    expect(buildDeployment(deployOpts).apiVersion).toBe('apps/v1');
  });

  it('sets kind to Deployment', () => {
    expect(buildDeployment(deployOpts).kind).toBe('Deployment');
  });

  it('sets metadata.name', () => {
    expect(buildDeployment(deployOpts).metadata.name).toBe('my-app');
  });

  it('sets metadata.namespace', () => {
    expect(buildDeployment(deployOpts).metadata.namespace).toBe('default');
  });

  it('sets spec.replicas', () => {
    const m = buildDeployment(deployOpts);
    expect((m as any).spec.replicas).toBe(2);
  });

  it('includes containers in pod spec', () => {
    const m = buildDeployment(deployOpts);
    expect((m as any).spec.template.spec.containers).toHaveLength(1);
  });

  it('sets serviceAccountName when provided', () => {
    const m = buildDeployment(deployOpts);
    expect((m as any).spec.template.spec.serviceAccountName).toBe('my-app');
  });

  it('omits serviceAccountName when undefined', () => {
    const m = buildDeployment({ ...deployOpts, serviceAccountName: undefined });
    expect((m as any).spec.template.spec.serviceAccountName).toBeUndefined();
  });

  it('embeds livenessProbe in container', () => {
    const c = (buildDeployment(deployOpts) as any).spec.template.spec.containers[0];
    expect(c.livenessProbe).toBeDefined();
    expect(c.livenessProbe.httpGet.path).toBe('/healthz');
  });

  it('embeds readinessProbe in container', () => {
    const c = (buildDeployment(deployOpts) as any).spec.template.spec.containers[0];
    expect(c.readinessProbe.httpGet.path).toBe('/readyz');
  });

  it('embeds resources in container', () => {
    const c = (buildDeployment(deployOpts) as any).spec.template.spec.containers[0];
    expect(c.resources.requests.cpu).toBe('100m');
  });

  it('selector matchLabels matches pod labels', () => {
    const m = buildDeployment(deployOpts) as any;
    expect(m.spec.selector.matchLabels).toEqual(META_LABELS);
  });
});

const META_LABELS = { app: 'my-app' };

// ── buildService ──────────────────────────────────────────────────────────────

describe('buildService', () => {
  it('sets apiVersion to v1', () => {
    expect(buildService(svcOpts).apiVersion).toBe('v1');
  });

  it('sets kind to Service', () => {
    expect(buildService(svcOpts).kind).toBe('Service');
  });

  it('sets spec.type', () => {
    expect((buildService(svcOpts) as any).spec.type).toBe('ClusterIP');
  });

  it('sets spec.selector', () => {
    expect((buildService(svcOpts) as any).spec.selector).toEqual({ app: 'my-app' });
  });

  it('sets spec.ports', () => {
    expect((buildService(svcOpts) as any).spec.ports).toHaveLength(1);
  });
});

// ── buildConfigMap ────────────────────────────────────────────────────────────

describe('buildConfigMap', () => {
  it('sets kind to ConfigMap', () => {
    expect(buildConfigMap(cmOpts).kind).toBe('ConfigMap');
  });

  it('sets data entries', () => {
    const m = buildConfigMap(cmOpts) as any;
    expect(m.data.LOG_LEVEL).toBe('info');
  });

  it('sets metadata.name', () => {
    expect(buildConfigMap(cmOpts).metadata.name).toBe('my-app');
  });
});

// ── buildHPA ──────────────────────────────────────────────────────────────────

describe('buildHPA', () => {
  it('sets kind to HorizontalPodAutoscaler', () => {
    expect(buildHPA(hpaOpts).kind).toBe('HorizontalPodAutoscaler');
  });

  it('sets spec.minReplicas', () => {
    expect((buildHPA(hpaOpts) as any).spec.minReplicas).toBe(2);
  });

  it('sets spec.maxReplicas', () => {
    expect((buildHPA(hpaOpts) as any).spec.maxReplicas).toBe(10);
  });

  it('scaleTargetRef.name matches targetName', () => {
    expect((buildHPA(hpaOpts) as any).spec.scaleTargetRef.name).toBe('my-app');
  });

  it('includes cpu metric', () => {
    const metrics = (buildHPA(hpaOpts) as any).spec.metrics as any[];
    const cpu = metrics.find((m: any) => m.resource?.name === 'cpu');
    expect(cpu?.resource.target.averageUtilization).toBe(70);
  });

  it('does not include memory metric when memoryUtilization is undefined', () => {
    const metrics = (buildHPA(hpaOpts) as any).spec.metrics as any[];
    const mem = metrics.find((m: any) => m.resource?.name === 'memory');
    expect(mem).toBeUndefined();
  });

  it('includes memory metric when memoryUtilization is set', () => {
    const m = buildHPA({ ...hpaOpts, memoryUtilization: 80 });
    const metrics = (m as any).spec.metrics as any[];
    const mem = metrics.find((x: any) => x.resource?.name === 'memory');
    expect(mem?.resource.target.averageUtilization).toBe(80);
  });
});

// ── buildPDB ──────────────────────────────────────────────────────────────────

describe('buildPDB', () => {
  it('sets kind to PodDisruptionBudget', () => {
    expect(buildPDB(pdbOpts).kind).toBe('PodDisruptionBudget');
  });

  it('sets spec.minAvailable when provided', () => {
    expect((buildPDB(pdbOpts) as any).spec.minAvailable).toBe(1);
  });

  it('sets spec.maxUnavailable when minAvailable is undefined', () => {
    const m = buildPDB({ ...pdbOpts, minAvailable: undefined, maxUnavailable: 1 });
    expect((m as any).spec.maxUnavailable).toBe(1);
  });

  it('sets spec.selector.matchLabels', () => {
    expect((buildPDB(pdbOpts) as any).spec.selector.matchLabels).toEqual({ app: 'my-app' });
  });
});

// ── buildNetworkPolicy ────────────────────────────────────────────────────────

describe('buildNetworkPolicy', () => {
  it('sets kind to NetworkPolicy', () => {
    expect(buildNetworkPolicy(netpolOpts).kind).toBe('NetworkPolicy');
  });

  it('sets policyTypes', () => {
    const m = buildNetworkPolicy(netpolOpts) as any;
    expect(m.spec.policyTypes).toContain('Ingress');
    expect(m.spec.policyTypes).toContain('Egress');
  });

  it('includes egress DNS rule', () => {
    const m = buildNetworkPolicy(netpolOpts) as any;
    expect(m.spec.egress).toHaveLength(1);
  });

  it('includes ingress from namespace when set', () => {
    const m = buildNetworkPolicy(netpolOpts) as any;
    const ingressRule = m.spec.ingress[0];
    expect(JSON.stringify(ingressRule)).toContain('ingress-nginx');
  });

  it('includes allowed port in ingress rule', () => {
    const m = buildNetworkPolicy(netpolOpts) as any;
    expect(JSON.stringify(m.spec.ingress)).toContain('3000');
  });

  it('ingress rule has no from when allowIngressFromNamespace is undefined', () => {
    const m = buildNetworkPolicy({ ...netpolOpts, allowIngressFromNamespace: undefined }) as any;
    const ingressRule = m.spec.ingress[0];
    expect(ingressRule.from).toBeUndefined();
  });
});

// ── buildIngress ──────────────────────────────────────────────────────────────

describe('buildIngress', () => {
  it('sets kind to Ingress', () => {
    expect(buildIngress(ingressOpts).kind).toBe('Ingress');
  });

  it('sets ingressClassName', () => {
    expect((buildIngress(ingressOpts) as any).spec.ingressClassName).toBe('nginx');
  });

  it('sets host in rules', () => {
    const m = buildIngress(ingressOpts) as any;
    expect(m.spec.rules[0].host).toBe('my-app.example.com');
  });

  it('sets tls when tlsSecretName provided', () => {
    expect((buildIngress(ingressOpts) as any).spec.tls).toBeDefined();
  });

  it('omits tls when tlsSecretName is undefined', () => {
    const m = buildIngress({ ...ingressOpts, tlsSecretName: undefined }) as any;
    expect(m.spec.tls).toBeUndefined();
  });

  it('sets backend service name', () => {
    const m = buildIngress(ingressOpts) as any;
    const path = m.spec.rules[0].http.paths[0];
    expect(path.backend.service.name).toBe('my-app');
  });
});

// ── validateDeployment ────────────────────────────────────────────────────────

describe('validateDeployment', () => {
  it('valid options pass', () => {
    expect(validateDeployment(deployOpts).valid).toBe(true);
  });

  it('empty name fails', () => {
    const opts = { ...deployOpts, metadata: { ...meta, name: '' } };
    expect(validateDeployment(opts).valid).toBe(false);
  });

  it('empty namespace fails', () => {
    const opts = { ...deployOpts, metadata: { ...meta, namespace: '' } };
    expect(validateDeployment(opts).valid).toBe(false);
  });

  it('negative replicas fails', () => {
    expect(validateDeployment({ ...deployOpts, replicas: -1 }).valid).toBe(false);
  });

  it('zero replicas is valid', () => {
    expect(validateDeployment({ ...deployOpts, replicas: 0 }).valid).toBe(true);
  });

  it('empty containers array fails', () => {
    expect(validateDeployment({ ...deployOpts, containers: [] }).valid).toBe(false);
  });

  it('container with empty name fails', () => {
    const bad = { ...container, name: '' };
    expect(validateDeployment({ ...deployOpts, containers: [bad] }).valid).toBe(false);
  });

  it('container with empty image fails', () => {
    const bad = { ...container, image: '' };
    expect(validateDeployment({ ...deployOpts, containers: [bad] }).valid).toBe(false);
  });
});

// ── validateService ───────────────────────────────────────────────────────────

describe('validateService', () => {
  it('valid options pass', () => {
    expect(validateService(svcOpts).valid).toBe(true);
  });

  it('empty name fails', () => {
    expect(validateService({ ...svcOpts, metadata: { ...meta, name: '' } }).valid).toBe(false);
  });

  it('empty ports fails', () => {
    expect(validateService({ ...svcOpts, ports: [] }).valid).toBe(false);
  });

  it('empty selector fails', () => {
    expect(validateService({ ...svcOpts, selector: {} }).valid).toBe(false);
  });
});

// ── validateHPA ───────────────────────────────────────────────────────────────

describe('validateHPA', () => {
  it('valid options pass', () => {
    expect(validateHPA(hpaOpts).valid).toBe(true);
  });

  it('minReplicas < 1 fails', () => {
    expect(validateHPA({ ...hpaOpts, minReplicas: 0 }).valid).toBe(false);
  });

  it('maxReplicas < minReplicas fails', () => {
    expect(validateHPA({ ...hpaOpts, minReplicas: 5, maxReplicas: 2 }).valid).toBe(false);
  });

  it('empty targetName fails', () => {
    expect(validateHPA({ ...hpaOpts, targetName: '' }).valid).toBe(false);
  });

  it('cpuUtilization 0 fails', () => {
    expect(validateHPA({ ...hpaOpts, cpuUtilization: 0 }).valid).toBe(false);
  });

  it('cpuUtilization 101 fails', () => {
    expect(validateHPA({ ...hpaOpts, cpuUtilization: 101 }).valid).toBe(false);
  });
});

// ── validatePDB ───────────────────────────────────────────────────────────────

describe('validatePDB', () => {
  it('valid options pass', () => {
    expect(validatePDB(pdbOpts).valid).toBe(true);
  });

  it('neither minAvailable nor maxUnavailable fails', () => {
    const r = validatePDB({ ...pdbOpts, minAvailable: undefined, maxUnavailable: undefined });
    expect(r.valid).toBe(false);
  });

  it('empty selector fails', () => {
    expect(validatePDB({ ...pdbOpts, selector: {} }).valid).toBe(false);
  });
});

// ── validateNetworkPolicy / validateIngress ───────────────────────────────────

describe('validateNetworkPolicy', () => {
  it('valid options pass', () => {
    expect(validateNetworkPolicy(netpolOpts).valid).toBe(true);
  });

  it('empty allowPorts fails', () => {
    expect(validateNetworkPolicy({ ...netpolOpts, allowPorts: [] }).valid).toBe(false);
  });
});

describe('validateIngress', () => {
  it('valid options pass', () => {
    expect(validateIngress(ingressOpts).valid).toBe(true);
  });

  it('empty host fails', () => {
    expect(validateIngress({ ...ingressOpts, host: '' }).valid).toBe(false);
  });

  it('empty paths fails', () => {
    expect(validateIngress({ ...ingressOpts, paths: [] }).valid).toBe(false);
  });

  it('empty ingressClassName fails', () => {
    expect(validateIngress({ ...ingressOpts, ingressClassName: '' }).valid).toBe(false);
  });
});
