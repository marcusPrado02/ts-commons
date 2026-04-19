import type { HelmValues, HelmReleaseValidation } from './types';

function validateImage(values: HelmValues, errors: string[]): void {
  if (values.image.repository.length === 0) {
    errors.push('image.repository must not be empty');
  }
  if (values.image.tag.length === 0) {
    errors.push('image.tag must not be empty');
  }
}

function validateReplicas(values: HelmValues, errors: string[]): void {
  if (values.replicaCount < 1) {
    errors.push('replicaCount must be >= 1');
  }
  if (values.autoscaling.enabled) {
    if (values.autoscaling.minReplicas < 1) {
      errors.push('autoscaling.minReplicas must be >= 1');
    }
    if (values.autoscaling.maxReplicas < values.autoscaling.minReplicas) {
      errors.push('autoscaling.maxReplicas must be >= autoscaling.minReplicas');
    }
  }
}

function validateResources(values: HelmValues, errors: string[]): void {
  if (values.resources.requests.cpu.length === 0) {
    errors.push('resources.requests.cpu must not be empty');
  }
  if (values.resources.requests.memory.length === 0) {
    errors.push('resources.requests.memory must not be empty');
  }
  if (values.resources.limits.cpu.length === 0) {
    errors.push('resources.limits.cpu must not be empty');
  }
  if (values.resources.limits.memory.length === 0) {
    errors.push('resources.limits.memory must not be empty');
  }
}

function validateProbes(values: HelmValues, errors: string[]): void {
  if (values.livenessProbe.path.length === 0) {
    errors.push('livenessProbe.path must not be empty');
  }
  if (values.readinessProbe.path.length === 0) {
    errors.push('readinessProbe.path must not be empty');
  }
  if (values.livenessProbe.initialDelaySeconds < 0) {
    errors.push('livenessProbe.initialDelaySeconds must be >= 0');
  }
  if (values.readinessProbe.initialDelaySeconds < 0) {
    errors.push('readinessProbe.initialDelaySeconds must be >= 0');
  }
}

function validateIngress(values: HelmValues, errors: string[]): void {
  if (!values.ingress.enabled) {
    return;
  }
  if (values.ingress.host.length === 0) {
    errors.push('ingress.host must not be empty when ingress is enabled');
  }
  if (values.ingress.paths.length === 0) {
    errors.push('ingress.paths must have at least one entry when ingress is enabled');
  }
  if (values.ingress.tls.enabled && values.ingress.tls.secretName.length === 0) {
    errors.push('ingress.tls.secretName must not be empty when TLS is enabled');
  }
}

function validatePDB(values: HelmValues, errors: string[]): void {
  if (!values.podDisruptionBudget.enabled) {
    return;
  }
  const { minAvailable, maxUnavailable } = values.podDisruptionBudget;
  if (minAvailable === undefined && maxUnavailable === undefined) {
    errors.push('podDisruptionBudget requires minAvailable or maxUnavailable when enabled');
  }
}

function validateService(values: HelmValues, errors: string[]): void {
  if (values.service.port < 1 || values.service.port > 65535) {
    errors.push('service.port must be between 1 and 65535');
  }
  if (values.service.targetPort < 1 || values.service.targetPort > 65535) {
    errors.push('service.targetPort must be between 1 and 65535');
  }
}

export function validateValues(values: HelmValues): HelmReleaseValidation {
  const errors: string[] = [];
  validateImage(values, errors);
  validateReplicas(values, errors);
  validateResources(values, errors);
  validateProbes(values, errors);
  validateIngress(values, errors);
  validatePDB(values, errors);
  validateService(values, errors);
  return { valid: errors.length === 0, errors };
}
