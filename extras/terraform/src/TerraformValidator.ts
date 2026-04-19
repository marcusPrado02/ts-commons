import type { TfModuleRef, TfVariable, TfWorkspace, TfValidationResult } from './types';

const VALID_NAME_RE = /^[a-z][a-z0-9_-]*$/;

function isValidName(name: string): boolean {
  return VALID_NAME_RE.test(name);
}

function noErrors(errors: string[]): TfValidationResult {
  return { valid: errors.length === 0, errors };
}

export function validateModuleRef(ref: TfModuleRef): TfValidationResult {
  const errors: string[] = [];
  if (!isValidName(ref.name)) {
    errors.push(`Module name "${ref.name}" must match [a-z][a-z0-9_-]*`);
  }
  if (ref.source.length === 0) {
    errors.push('Module source must not be empty');
  }
  return noErrors(errors);
}

export function validateVariable(variable: TfVariable): TfValidationResult {
  const errors: string[] = [];
  if (!isValidName(variable.name)) {
    errors.push(`Variable name "${variable.name}" must match [a-z][a-z0-9_-]*`);
  }
  if (variable.description.length === 0) {
    errors.push(`Variable "${variable.name}" must have a description`);
  }
  const validTypes = new Set(['string', 'number', 'bool', 'list(string)', 'map(string)', 'any']);
  if (!validTypes.has(variable.type)) {
    errors.push(`Variable "${variable.name}" has invalid type "${variable.type}"`);
  }
  return noErrors(errors);
}

export function validateWorkspace(workspace: TfWorkspace): TfValidationResult {
  const errors: string[] = [];
  if (!isValidName(workspace.name)) {
    errors.push(`Workspace name "${workspace.name}" must match [a-z][a-z0-9_-]*`);
  }
  if (workspace.region.length === 0) {
    errors.push('Workspace region must not be empty');
  }
  const validEnvironments = new Set(['dev', 'staging', 'production']);
  if (!validEnvironments.has(workspace.environment)) {
    errors.push(`Invalid environment "${workspace.environment}"`);
  }
  const validClouds = new Set(['aws', 'azure', 'gcp']);
  if (!validClouds.has(workspace.cloud)) {
    errors.push(`Invalid cloud "${workspace.cloud}"`);
  }
  if (workspace.backend.type !== 'local') {
    if ((workspace.backend.bucket ?? '').length === 0) {
      errors.push('Backend bucket must not be empty for non-local backends');
    }
    if ((workspace.backend.key ?? '').length === 0) {
      errors.push('Backend key must not be empty for non-local backends');
    }
  }
  return noErrors(errors);
}
