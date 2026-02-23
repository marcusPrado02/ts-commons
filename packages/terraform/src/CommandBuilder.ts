import type { TfCommand, TfCommandOptions } from './types';

function buildVarFileFlag(varFile: string | undefined): string {
  if (varFile === undefined) return '';
  return `-var-file="${varFile}"`;
}

function buildTargetFlag(target: string | undefined): string {
  if (target === undefined) return '';
  return `-target="${target}"`;
}

function buildWorkspaceFlag(workspace: string | undefined): string {
  if (workspace === undefined) return '';
  return `-workspace="${workspace}"`;
}

function compact(parts: string[]): string {
  return parts.filter((p) => p.length > 0).join(' ');
}

function buildDefaultOptions(): TfCommandOptions {
  return {
    varFile: undefined,
    planFile: undefined,
    autoApprove: false,
    target: undefined,
    workspace: undefined,
  };
}

function buildInitCommand(_options: TfCommandOptions): string {
  return 'terraform init -upgrade';
}

function buildPlanCommand(options: TfCommandOptions): string {
  const parts = ['terraform plan'];
  parts.push(buildVarFileFlag(options.varFile));
  parts.push(buildTargetFlag(options.target));
  if (options.planFile !== undefined) {
    parts.push(`-out="${options.planFile}"`);
  }
  return compact(parts);
}

function buildApplyCommand(options: TfCommandOptions): string {
  if (options.planFile !== undefined) {
    return compact(['terraform apply', `"${options.planFile}"`]);
  }
  const parts = ['terraform apply'];
  parts.push(buildVarFileFlag(options.varFile));
  parts.push(buildTargetFlag(options.target));
  if (options.autoApprove) {
    parts.push('-auto-approve');
  }
  return compact(parts);
}

function buildDestroyCommand(options: TfCommandOptions): string {
  const parts = ['terraform destroy'];
  parts.push(buildVarFileFlag(options.varFile));
  parts.push(buildTargetFlag(options.target));
  if (options.autoApprove) {
    parts.push('-auto-approve');
  }
  return compact(parts);
}

function buildValidateCommand(_options: TfCommandOptions): string {
  return 'terraform validate';
}

function buildFmtCommand(_options: TfCommandOptions): string {
  return 'terraform fmt -recursive';
}

function buildOutputCommand(options: TfCommandOptions): string {
  return compact(['terraform output', buildWorkspaceFlag(options.workspace), '-json']);
}

export function buildTerraformCommand(
  command: TfCommand,
  options: Partial<TfCommandOptions> = {},
): string {
  const opts: TfCommandOptions = { ...buildDefaultOptions(), ...options };
  switch (command) {
    case 'init':
      return buildInitCommand(opts);
    case 'plan':
      return buildPlanCommand(opts);
    case 'apply':
      return buildApplyCommand(opts);
    case 'destroy':
      return buildDestroyCommand(opts);
    case 'validate':
      return buildValidateCommand(opts);
    case 'fmt':
      return buildFmtCommand(opts);
    case 'output':
      return buildOutputCommand(opts);
  }
}

export function buildWorkflowCommands(varFile: string): {
  init: string;
  validate: string;
  plan: string;
  apply: string;
  fmt: string;
} {
  return {
    fmt: buildTerraformCommand('fmt'),
    init: buildTerraformCommand('init'),
    validate: buildTerraformCommand('validate'),
    plan: buildTerraformCommand('plan', { varFile, planFile: 'tfplan' }),
    apply: buildTerraformCommand('apply', { planFile: 'tfplan' }),
  };
}
