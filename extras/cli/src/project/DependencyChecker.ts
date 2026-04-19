import type { DependencyInfo, DependencyCheckResult } from '../cli/CliTypes';

function semverMajor(version: string): number {
  const parts = version.replace(/^[^0-9]*/, '').split('.');
  return parseInt(parts[0] ?? '0', 10);
}

function semverMinor(version: string): number {
  const parts = version.replace(/^[^0-9]*/, '').split('.');
  return parseInt(parts[1] ?? '0', 10);
}

function isCompatible(installed: string, required: string): boolean {
  const reqPrefix = required.charAt(0);
  const clean = required.replace(/^[^0-9]*/, '');
  const cleanInstalled = installed.replace(/^[^0-9]*/, '');

  if (reqPrefix === '^') {
    return (
      semverMajor(cleanInstalled) === semverMajor(clean) &&
      semverMinor(cleanInstalled) >= semverMinor(clean)
    );
  }
  if (reqPrefix === '~') {
    return (
      semverMajor(cleanInstalled) === semverMajor(clean) &&
      semverMinor(cleanInstalled) === semverMinor(clean)
    );
  }
  return cleanInstalled === clean;
}

/**
 * Checks whether a set of installed packages satisfy declared version
 * requirements without invoking npm/pnpm.
 *
 * @example
 * ```typescript
 * const checker = new DependencyChecker();
 * checker.declare('typescript', '^5.0.0');
 * checker.setInstalled('typescript', '5.3.0');
 * const result = checker.check();
 * ```
 */
export class DependencyChecker {
  private readonly required = new Map<string, string>();
  private readonly installed = new Map<string, string>();

  /** Declare a required dependency with its version range. */
  declare(name: string, requiredVersion: string): void {
    this.required.set(name, requiredVersion);
  }

  /** Register the actually installed version of a package. */
  setInstalled(name: string, version: string): void {
    this.installed.set(name, version);
  }

  /** Remove a declared requirement. */
  removeDeclaration(name: string): boolean {
    return this.required.delete(name);
  }

  declaredCount(): number {
    return this.required.size;
  }

  /** Run the compatibility check over all declared dependencies. */
  check(): DependencyCheckResult {
    const results: DependencyInfo[] = [];
    for (const [name, requiredVersion] of this.required.entries()) {
      const installedVersion = this.installed.get(name) ?? '0.0.0';
      const compatible = isCompatible(installedVersion, requiredVersion);
      results.push({ name, installedVersion, requiredVersion, compatible });
    }
    const incompatible = results.filter((r) => !r.compatible);
    return {
      compatible: incompatible.length === 0,
      checked: results.length,
      incompatible,
    };
  }

  /** Return all dependency info without filtering. */
  getAll(): DependencyInfo[] {
    return [...this.required.entries()].map(([name, requiredVersion]) => {
      const installedVersion = this.installed.get(name) ?? '0.0.0';
      return {
        name,
        installedVersion,
        requiredVersion,
        compatible: isCompatible(installedVersion, requiredVersion),
      };
    });
  }

  clear(): void {
    this.required.clear();
    this.installed.clear();
  }
}
