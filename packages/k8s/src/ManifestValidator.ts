import type {
  DeploymentOptions,
  ServiceOptions,
  ConfigMapOptions,
  HPAOptions,
  PDBOptions,
  NetworkPolicyOptions,
  IngressOptions,
  ValidationResult,
} from './types';

function err(msg: string): string {
  return msg;
}

function metaErrors(name: string, ns: string): string[] {
  const errors: string[] = [];
  if (name.trim().length === 0) errors.push('metadata.name is required');
  if (ns.trim().length === 0) errors.push('metadata.namespace is required');
  return errors;
}

export function validateDeployment(opts: DeploymentOptions): ValidationResult {
  const errors = metaErrors(opts.metadata.name, opts.metadata.namespace);
  if (opts.replicas < 0) errors.push('replicas must be >= 0');
  if (opts.containers.length === 0) errors.push('at least one container is required');
  for (const c of opts.containers) {
    if (c.name.trim().length === 0) errors.push('container name is required');
    if (c.image.trim().length === 0) errors.push(`container '${c.name}' image is required`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateService(opts: ServiceOptions): ValidationResult {
  const errors = metaErrors(opts.metadata.name, opts.metadata.namespace);
  if (opts.ports.length === 0) errors.push('at least one port is required');
  if (Object.keys(opts.selector).length === 0) errors.push(err('selector must not be empty'));
  return { valid: errors.length === 0, errors };
}

export function validateConfigMap(opts: ConfigMapOptions): ValidationResult {
  const errors = metaErrors(opts.metadata.name, opts.metadata.namespace);
  return { valid: errors.length === 0, errors };
}

export function validateHPA(opts: HPAOptions): ValidationResult {
  const errors = metaErrors(opts.metadata.name, opts.metadata.namespace);
  if (opts.minReplicas < 1) errors.push('minReplicas must be >= 1');
  if (opts.maxReplicas < opts.minReplicas) errors.push('maxReplicas must be >= minReplicas');
  if (opts.targetName.trim().length === 0) errors.push('targetName is required');
  if (opts.cpuUtilization < 1 || opts.cpuUtilization > 100) {
    errors.push('cpuUtilization must be between 1 and 100');
  }
  return { valid: errors.length === 0, errors };
}

export function validatePDB(opts: PDBOptions): ValidationResult {
  const errors = metaErrors(opts.metadata.name, opts.metadata.namespace);
  if (opts.minAvailable === undefined && opts.maxUnavailable === undefined) {
    errors.push('either minAvailable or maxUnavailable must be specified');
  }
  if (Object.keys(opts.selector).length === 0) errors.push(err('selector must not be empty'));
  return { valid: errors.length === 0, errors };
}

export function validateNetworkPolicy(opts: NetworkPolicyOptions): ValidationResult {
  const errors = metaErrors(opts.metadata.name, opts.metadata.namespace);
  if (opts.allowPorts.length === 0) errors.push('allowPorts must not be empty');
  return { valid: errors.length === 0, errors };
}

export function validateIngress(opts: IngressOptions): ValidationResult {
  const errors = metaErrors(opts.metadata.name, opts.metadata.namespace);
  if (opts.host.trim().length === 0) errors.push('host is required');
  if (opts.paths.length === 0) errors.push('at least one path is required');
  if (opts.ingressClassName.trim().length === 0) errors.push('ingressClassName is required');
  return { valid: errors.length === 0, errors };
}
