import type { DeploymentOptions, ContainerSpec, HttpProbe, K8sManifestBase } from '../types';

// ── Probe helper ─────────────────────────────────────────────────────────────

function buildProbe(probe: HttpProbe): Record<string, unknown> {
  return {
    httpGet: { path: probe.path, port: probe.port },
    initialDelaySeconds: probe.initialDelaySeconds,
    periodSeconds: probe.periodSeconds,
    timeoutSeconds: probe.timeoutSeconds,
    failureThreshold: probe.failureThreshold,
  };
}

// ── Container helper ──────────────────────────────────────────────────────────

function buildContainer(c: ContainerSpec): Record<string, unknown> {
  const container: Record<string, unknown> = {
    name: c.name,
    image: c.image,
    ports: c.ports,
    env: c.env,
  };
  if (c.resources !== undefined) container['resources'] = c.resources;
  if (c.livenessProbe !== undefined) container['livenessProbe'] = buildProbe(c.livenessProbe);
  if (c.readinessProbe !== undefined) container['readinessProbe'] = buildProbe(c.readinessProbe);
  return container;
}

// ── Deployment ────────────────────────────────────────────────────────────────

export function buildDeployment(
  opts: DeploymentOptions,
): K8sManifestBase & Record<string, unknown> {
  const spec: Record<string, unknown> = {
    replicas: opts.replicas,
    selector: { matchLabels: opts.metadata.labels },
    template: {
      metadata: { labels: opts.metadata.labels },
      spec: buildPodSpec(opts),
    },
  };
  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: opts.metadata.name,
      namespace: opts.metadata.namespace,
      labels: opts.metadata.labels,
      annotations: opts.metadata.annotations,
    },
    spec,
  };
}

function buildPodSpec(opts: DeploymentOptions): Record<string, unknown> {
  const podSpec: Record<string, unknown> = {
    containers: opts.containers.map(buildContainer),
  };
  if (opts.serviceAccountName !== undefined) {
    podSpec['serviceAccountName'] = opts.serviceAccountName;
  }
  return podSpec;
}
