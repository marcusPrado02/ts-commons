import type { IngressOptions, IngressPath, K8sManifestBase } from '../types';

function buildHttpPath(p: IngressPath): Record<string, unknown> {
  return {
    path: p.path,
    pathType: p.pathType,
    backend: {
      service: {
        name: p.serviceName,
        port:
          typeof p.servicePort === 'number' ? { number: p.servicePort } : { name: p.servicePort },
      },
    },
  };
}

function buildTls(opts: IngressOptions): unknown[] | undefined {
  if (opts.tlsSecretName === undefined) return undefined;
  return [{ hosts: [opts.host], secretName: opts.tlsSecretName }];
}

export function buildIngress(opts: IngressOptions): K8sManifestBase & Record<string, unknown> {
  const manifest: Record<string, unknown> = {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: {
      name: opts.metadata.name,
      namespace: opts.metadata.namespace,
      labels: opts.metadata.labels,
      annotations: opts.metadata.annotations,
    },
    spec: {
      ingressClassName: opts.ingressClassName,
      rules: [
        {
          host: opts.host,
          http: { paths: opts.paths.map(buildHttpPath) },
        },
      ],
    },
  };
  const tls = buildTls(opts);
  if (tls !== undefined) {
    (manifest['spec'] as Record<string, unknown>)['tls'] = tls;
  }
  return manifest as K8sManifestBase & Record<string, unknown>;
}
