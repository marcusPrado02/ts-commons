/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { ValuesBuilder } from './ValuesBuilder';
import { validateValues } from './ChartValidator';
import { buildHelmCommand, buildReleaseCommands } from './ReleaseCommands';
import type { HelmValues, HelmRelease } from './types';

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makeRelease(overrides: Partial<HelmRelease> = {}): HelmRelease {
  return {
    name: 'my-app',
    chart: './helm/ts-commons',
    namespace: 'default',
    valuesFile: undefined,
    setValues: {},
    atomic: false,
    timeout: '5m',
    dryRun: false,
    ...overrides,
  };
}

// ─── ValuesBuilder ─────────────────────────────────────────────────────────

describe('ValuesBuilder', () => {
  it('returns default values on empty build', () => {
    const v = new ValuesBuilder().build();
    expect(v.replicaCount).toBe(1);
    expect(v.image.repository).toBe('acme/app');
    expect(v.image.tag).toBe('latest');
    expect(v.image.pullPolicy).toBe('IfNotPresent');
  });

  it('setImage updates repository', () => {
    const v = new ValuesBuilder().setImage({ repository: 'my-registry/my-app' }).build();
    expect(v.image.repository).toBe('my-registry/my-app');
    expect(v.image.tag).toBe('latest');
  });

  it('setImage updates tag and pullPolicy', () => {
    const v = new ValuesBuilder().setImage({ tag: '1.2.3', pullPolicy: 'Always' }).build();
    expect(v.image.tag).toBe('1.2.3');
    expect(v.image.pullPolicy).toBe('Always');
  });

  it('setReplicas sets replicaCount', () => {
    const v = new ValuesBuilder().setReplicas(3).build();
    expect(v.replicaCount).toBe(3);
  });

  it('setResources updates requests and limits', () => {
    const v = new ValuesBuilder()
      .setResources({
        requests: { cpu: '200m', memory: '256Mi' },
        limits: { cpu: '1', memory: '1Gi' },
      })
      .build();
    expect(v.resources.requests.cpu).toBe('200m');
    expect(v.resources.limits.memory).toBe('1Gi');
  });

  it('setAutoscaling enables autoscaling', () => {
    const v = new ValuesBuilder()
      .setAutoscaling({ enabled: true, minReplicas: 2, maxReplicas: 5 })
      .build();
    expect(v.autoscaling.enabled).toBe(true);
    expect(v.autoscaling.minReplicas).toBe(2);
    expect(v.autoscaling.maxReplicas).toBe(5);
  });

  it('setAutoscaling preserves default cpu threshold', () => {
    const v = new ValuesBuilder().setAutoscaling({ enabled: true }).build();
    expect(v.autoscaling.targetCPUUtilizationPercentage).toBe(70);
  });

  it('enablePDB sets enabled to true', () => {
    const v = new ValuesBuilder().enablePDB({ minAvailable: 1 }).build();
    expect(v.podDisruptionBudget.enabled).toBe(true);
    expect(v.podDisruptionBudget.minAvailable).toBe(1);
  });

  it('enablePDB with maxUnavailable keeps minAvailable undefined', () => {
    const v = new ValuesBuilder().enablePDB({ minAvailable: undefined, maxUnavailable: 1 }).build();
    expect(v.podDisruptionBudget.maxUnavailable).toBe(1);
  });

  it('setIngress enables ingress with host', () => {
    const v = new ValuesBuilder().setIngress({ enabled: true, host: 'api.example.com' }).build();
    expect(v.ingress.enabled).toBe(true);
    expect(v.ingress.host).toBe('api.example.com');
  });

  it('setIngress preserves default paths', () => {
    const v = new ValuesBuilder().setIngress({ enabled: true }).build();
    expect(v.ingress.paths).toHaveLength(1);
    expect(v.ingress.paths[0]?.path).toBe('/');
  });

  it('setEnv merges env vars', () => {
    const v = new ValuesBuilder().setEnv({ NODE_ENV: 'production', PORT: '3000' }).build();
    expect(v.env['NODE_ENV']).toBe('production');
    expect(v.env['PORT']).toBe('3000');
  });

  it('setEnv merges multiple calls', () => {
    const v = new ValuesBuilder().setEnv({ A: '1' }).setEnv({ B: '2' }).build();
    expect(v.env['A']).toBe('1');
    expect(v.env['B']).toBe('2');
  });

  it('setConfig merges config', () => {
    const v = new ValuesBuilder().setConfig({ logLevel: 'info', port: '3000' }).build();
    expect(v.config['logLevel']).toBe('info');
  });

  it('setTerminationGracePeriod sets seconds', () => {
    const v = new ValuesBuilder().setTerminationGracePeriod(60).build();
    expect(v.terminationGracePeriodSeconds).toBe(60);
  });

  it('build returns a clone, not a reference', () => {
    const builder = new ValuesBuilder();
    const a = builder.build();
    const b = builder.build();
    expect(a).not.toBe(b);
    a.replicaCount = 999;
    expect(b.replicaCount).toBe(1);
  });

  it('accepts base overrides in constructor', () => {
    const v = new ValuesBuilder({ replicaCount: 5 }).build();
    expect(v.replicaCount).toBe(5);
  });

  it('chaining returns same builder instance', () => {
    const builder = new ValuesBuilder();
    const result = builder.setReplicas(2).setImage({ tag: '2.0.0' });
    expect(result).toBe(builder);
  });

  it('default livenessProbe path is /healthz', () => {
    const v = new ValuesBuilder().build();
    expect(v.livenessProbe.path).toBe('/healthz');
  });

  it('default readinessProbe path is /readyz', () => {
    const v = new ValuesBuilder().build();
    expect(v.readinessProbe.path).toBe('/readyz');
  });
});

// ─── ChartValidator ─────────────────────────────────────────────────────────

describe('validateValues', () => {
  function validValues(): HelmValues {
    return new ValuesBuilder().setImage({ repository: 'acme/app', tag: '1.0.0' }).build();
  }

  it('returns valid for correct default values', () => {
    const result = validateValues(validValues());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('errors on empty image.repository', () => {
    const v = validValues();
    v.image.repository = '';
    const result = validateValues(v);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('image.repository must not be empty');
  });

  it('errors on empty image.tag', () => {
    const v = validValues();
    v.image.tag = '';
    const result = validateValues(v);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('image.tag must not be empty');
  });

  it('errors on replicaCount < 1', () => {
    const v = validValues();
    v.replicaCount = 0;
    const result = validateValues(v);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('replicaCount must be >= 1');
  });

  it('errors when autoscaling maxReplicas < minReplicas', () => {
    const v = new ValuesBuilder()
      .setImage({ repository: 'acme/app', tag: '1.0.0' })
      .setAutoscaling({ enabled: true, minReplicas: 5, maxReplicas: 2 })
      .build();
    const result = validateValues(v);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('autoscaling.maxReplicas must be >= autoscaling.minReplicas');
  });

  it('errors on empty resources.requests.cpu', () => {
    const v = validValues();
    v.resources.requests.cpu = '';
    const result = validateValues(v);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('resources.requests.cpu must not be empty');
  });

  it('errors on empty resources.limits.memory', () => {
    const v = validValues();
    v.resources.limits.memory = '';
    const result = validateValues(v);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('resources.limits.memory must not be empty');
  });

  it('errors on empty livenessProbe.path', () => {
    const v = validValues();
    v.livenessProbe.path = '';
    const result = validateValues(v);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('livenessProbe.path must not be empty');
  });

  it('errors on empty readinessProbe.path', () => {
    const v = validValues();
    v.readinessProbe.path = '';
    const result = validateValues(v);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('readinessProbe.path must not be empty');
  });

  it('errors on negative livenessProbe.initialDelaySeconds', () => {
    const v = validValues();
    v.livenessProbe.initialDelaySeconds = -1;
    const result = validateValues(v);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('livenessProbe.initialDelaySeconds must be >= 0');
  });

  it('no ingress errors when disabled', () => {
    const v = validValues();
    v.ingress.enabled = false;
    v.ingress.host = '';
    const result = validateValues(v);
    expect(result.valid).toBe(true);
  });

  it('errors on empty ingress.host when enabled', () => {
    const v = validValues();
    v.ingress.enabled = true;
    v.ingress.host = '';
    const result = validateValues(v);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('ingress.host must not be empty when ingress is enabled');
  });

  it('errors on empty ingress.paths when enabled', () => {
    const v = validValues();
    v.ingress.enabled = true;
    v.ingress.paths = [];
    const result = validateValues(v);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'ingress.paths must have at least one entry when ingress is enabled',
    );
  });

  it('errors on TLS enabled but empty secretName', () => {
    const v = validValues();
    v.ingress.enabled = true;
    v.ingress.tls.enabled = true;
    v.ingress.tls.secretName = '';
    const result = validateValues(v);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('ingress.tls.secretName must not be empty when TLS is enabled');
  });

  it('no PDB errors when disabled', () => {
    const v = validValues();
    v.podDisruptionBudget.enabled = false;
    v.podDisruptionBudget.minAvailable = undefined;
    v.podDisruptionBudget.maxUnavailable = undefined;
    const result = validateValues(v);
    expect(result.valid).toBe(true);
  });

  it('errors on PDB enabled with no minAvailable or maxUnavailable', () => {
    const v = validValues();
    v.podDisruptionBudget.enabled = true;
    v.podDisruptionBudget.minAvailable = undefined;
    v.podDisruptionBudget.maxUnavailable = undefined;
    const result = validateValues(v);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'podDisruptionBudget requires minAvailable or maxUnavailable when enabled',
    );
  });

  it('valid PDB with maxUnavailable', () => {
    const v = new ValuesBuilder()
      .setImage({ repository: 'acme/app', tag: '1.0.0' })
      .enablePDB({ minAvailable: undefined, maxUnavailable: 1 })
      .build();
    const result = validateValues(v);
    expect(result.valid).toBe(true);
  });

  it('errors on service.port out of range', () => {
    const v = validValues();
    v.service.port = 0;
    const result = validateValues(v);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('service.port must be between 1 and 65535');
  });

  it('errors on service.targetPort out of range', () => {
    const v = validValues();
    v.service.targetPort = 70000;
    const result = validateValues(v);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('service.targetPort must be between 1 and 65535');
  });

  it('accumulates multiple errors', () => {
    const v = validValues();
    v.image.repository = '';
    v.image.tag = '';
    v.replicaCount = 0;
    const result = validateValues(v);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── ReleaseCommands ────────────────────────────────────────────────────────

describe('buildHelmCommand', () => {
  it('install produces correct command', () => {
    const cmd = buildHelmCommand('install', makeRelease());
    expect(cmd).toContain('helm install my-app');
    expect(cmd).toContain('--namespace default');
    expect(cmd).toContain('--timeout 5m');
  });

  it('upgrade produces --install flag', () => {
    const cmd = buildHelmCommand('upgrade', makeRelease());
    expect(cmd).toContain('helm upgrade --install');
  });

  it('uninstall produces correct command', () => {
    const cmd = buildHelmCommand('uninstall', makeRelease());
    expect(cmd).toBe('helm uninstall my-app --namespace default');
  });

  it('diff produces diff upgrade command', () => {
    const cmd = buildHelmCommand('diff', makeRelease());
    expect(cmd).toContain('helm diff upgrade my-app');
  });

  it('lint produces helm lint command', () => {
    const cmd = buildHelmCommand('lint', makeRelease());
    expect(cmd).toContain('helm lint ./helm/ts-commons');
  });

  it('template produces helm template command', () => {
    const cmd = buildHelmCommand('template', makeRelease());
    expect(cmd).toContain('helm template my-app');
  });

  it('includes -f when valuesFile is set', () => {
    const cmd = buildHelmCommand('install', makeRelease({ valuesFile: 'values.prod.yaml' }));
    expect(cmd).toContain('-f values.prod.yaml');
  });

  it('does not include -f when valuesFile is undefined', () => {
    const cmd = buildHelmCommand('install', makeRelease());
    expect(cmd).not.toContain('-f');
  });

  it('includes --set flags', () => {
    const cmd = buildHelmCommand('install', makeRelease({ setValues: { 'image.tag': '2.0.0' } }));
    expect(cmd).toContain('--set image.tag=2.0.0');
  });

  it('includes --atomic when atomic is true', () => {
    const cmd = buildHelmCommand('install', makeRelease({ atomic: true }));
    expect(cmd).toContain('--atomic');
  });

  it('excludes --atomic when atomic is false', () => {
    const cmd = buildHelmCommand('install', makeRelease({ atomic: false }));
    expect(cmd).not.toContain('--atomic');
  });

  it('includes --dry-run when dryRun is true', () => {
    const cmd = buildHelmCommand('upgrade', makeRelease({ dryRun: true }));
    expect(cmd).toContain('--dry-run');
  });

  it('lint includes -f when valuesFile set', () => {
    const cmd = buildHelmCommand('lint', makeRelease({ valuesFile: 'values.yaml' }));
    expect(cmd).toContain('-f values.yaml');
  });

  it('lint does not include namespace flag', () => {
    const cmd = buildHelmCommand('lint', makeRelease());
    expect(cmd).not.toContain('--namespace');
  });
});

describe('buildReleaseCommands', () => {
  it('returns all 6 command variants', () => {
    const cmds = buildReleaseCommands(makeRelease());
    expect(typeof cmds.install).toBe('string');
    expect(typeof cmds.upgrade).toBe('string');
    expect(typeof cmds.uninstall).toBe('string');
    expect(typeof cmds.diff).toBe('string');
    expect(typeof cmds.lint).toBe('string');
    expect(typeof cmds.template).toBe('string');
  });

  it('all commands reference the correct release name', () => {
    const release = makeRelease({ name: 'my-service' });
    const cmds = buildReleaseCommands(release);
    expect(cmds.install).toContain('my-service');
    expect(cmds.upgrade).toContain('my-service');
    expect(cmds.uninstall).toContain('my-service');
    expect(cmds.diff).toContain('my-service');
    expect(cmds.template).toContain('my-service');
  });

  it('different namespaces are reflected in commands', () => {
    const cmds = buildReleaseCommands(makeRelease({ namespace: 'production' }));
    expect(cmds.install).toContain('--namespace production');
    expect(cmds.upgrade).toContain('--namespace production');
  });
});
