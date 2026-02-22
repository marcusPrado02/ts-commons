import type { VersionRecord } from '../cli/CliTypes';

function cleanVersion(v: string): string {
  return v.replace(/^[^0-9]*/, '');
}

function versionTuple(v: string): [number, number, number] {
  const parts = cleanVersion(v).split('.');
  return [
    parseInt(parts[0] ?? '0', 10),
    parseInt(parts[1] ?? '0', 10),
    parseInt(parts[2] ?? '0', 10),
  ];
}

function isOutdated(installed: string, latest: string): boolean {
  const [iMaj, iMin, iPat] = versionTuple(installed);
  const [lMaj, lMin, lPat] = versionTuple(latest);
  if (lMaj !== iMaj) return lMaj > iMaj;
  if (lMin !== iMin) return lMin > iMin;
  return lPat > iPat;
}

/**
 * Tracks current and latest versions of project packages and reports
 * which are outdated.
 *
 * @example
 * ```typescript
 * const manager = new VersionManager();
 * manager.register('typescript', '5.2.0', '5.3.0');
 * const outdated = manager.getOutdated();
 * ```
 */
export class VersionManager {
  private readonly records = new Map<string, VersionRecord>();

  /**
   * Register or update a package version entry.
   * Pass `latest` to compare against; omit to mark as up-to-date.
   */
  register(pkg: string, version: string, latest?: string): void {
    const record: VersionRecord = {
      package: pkg,
      version,
      outdated: latest !== undefined ? isOutdated(version, latest) : false,
      ...(latest !== undefined ? { latest } : {}),
    };
    this.records.set(pkg, record);
  }

  has(pkg: string): boolean {
    return this.records.has(pkg);
  }

  get(pkg: string): VersionRecord | undefined {
    return this.records.get(pkg);
  }

  getAll(): VersionRecord[] {
    return [...this.records.values()];
  }

  getOutdated(): VersionRecord[] {
    return this.getAll().filter((r) => r.outdated);
  }

  getUpToDate(): VersionRecord[] {
    return this.getAll().filter((r) => !r.outdated);
  }

  packageCount(): number {
    return this.records.size;
  }

  outdatedCount(): number {
    return this.getOutdated().length;
  }

  remove(pkg: string): boolean {
    return this.records.delete(pkg);
  }

  /** Formatted summary string for CLI output. */
  summary(): string {
    const total = this.records.size;
    if (total === 0) return 'No packages tracked.';
    const outdated = this.outdatedCount();
    const lines = [`${total} package(s) tracked. ${outdated} outdated.`];
    for (const r of this.getOutdated()) {
      const latest = r.latest ?? '?';
      lines.push(`  ${r.package}: ${r.version} → ${latest}`);
    }
    return lines.join('\n');
  }

  clear(): void {
    this.records.clear();
  }
}
