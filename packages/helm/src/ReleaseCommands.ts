import type { HelmRelease, HelmCommand } from './types';

function buildSetFlags(setValues: Record<string, string>): string {
  return Object.entries(setValues)
    .map(([k, v]) => `--set ${k}=${v}`)
    .join(' ');
}

function buildCommonFlags(release: HelmRelease): string {
  const parts: string[] = [`--namespace ${release.namespace}`];
  if (release.valuesFile !== undefined) {
    parts.push(`-f ${release.valuesFile}`);
  }
  const setFlags = buildSetFlags(release.setValues);
  if (setFlags.length > 0) {
    parts.push(setFlags);
  }
  return parts.join(' ');
}

function buildInstallUpgradeFlags(release: HelmRelease): string {
  const parts: string[] = [];
  if (release.atomic) {
    parts.push('--atomic');
  }
  parts.push(`--timeout ${release.timeout}`);
  if (release.dryRun) {
    parts.push('--dry-run');
  }
  return parts.join(' ');
}

function buildInstallCommand(release: HelmRelease): string {
  const common = buildCommonFlags(release);
  const flags = buildInstallUpgradeFlags(release);
  return `helm install ${release.name} ${release.chart} ${common} ${flags}`.trimEnd();
}

function buildUpgradeCommand(release: HelmRelease): string {
  const common = buildCommonFlags(release);
  const flags = buildInstallUpgradeFlags(release);
  return `helm upgrade --install ${release.name} ${release.chart} ${common} ${flags}`.trimEnd();
}

function buildUninstallCommand(release: HelmRelease): string {
  return `helm uninstall ${release.name} --namespace ${release.namespace}`;
}

function buildDiffCommand(release: HelmRelease): string {
  const common = buildCommonFlags(release);
  return `helm diff upgrade ${release.name} ${release.chart} ${common}`.trimEnd();
}

function buildLintCommand(release: HelmRelease): string {
  const parts: string[] = [`helm lint ${release.chart}`];
  if (release.valuesFile !== undefined) {
    parts.push(`-f ${release.valuesFile}`);
  }
  const setFlags = buildSetFlags(release.setValues);
  if (setFlags.length > 0) {
    parts.push(setFlags);
  }
  return parts.join(' ');
}

function buildTemplateCommand(release: HelmRelease): string {
  const common = buildCommonFlags(release);
  return `helm template ${release.name} ${release.chart} ${common}`.trimEnd();
}

export function buildHelmCommand(command: HelmCommand, release: HelmRelease): string {
  switch (command) {
    case 'install':
      return buildInstallCommand(release);
    case 'upgrade':
      return buildUpgradeCommand(release);
    case 'uninstall':
      return buildUninstallCommand(release);
    case 'diff':
      return buildDiffCommand(release);
    case 'lint':
      return buildLintCommand(release);
    case 'template':
      return buildTemplateCommand(release);
  }
}

export function buildReleaseCommands(release: HelmRelease): {
  install: string;
  upgrade: string;
  uninstall: string;
  diff: string;
  lint: string;
  template: string;
} {
  return {
    install: buildHelmCommand('install', release),
    upgrade: buildHelmCommand('upgrade', release),
    uninstall: buildHelmCommand('uninstall', release),
    diff: buildHelmCommand('diff', release),
    lint: buildHelmCommand('lint', release),
    template: buildHelmCommand('template', release),
  };
}
