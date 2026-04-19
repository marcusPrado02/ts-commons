import type { HealthCheck, HealthReport, HealthStatus } from './types';

type CheckFn = () => Promise<HealthCheck>;

export class HealthAggregator {
  private readonly checks = new Map<string, CheckFn>();
  private readonly version: string | undefined;

  constructor(version?: string) {
    this.version = version;
  }

  register(name: string, fn: CheckFn): void {
    this.checks.set(name, fn);
  }

  count(): number {
    return this.checks.size;
  }

  names(): string[] {
    return [...this.checks.keys()];
  }

  overallStatus(checks: HealthCheck[]): HealthStatus {
    if (checks.some((c) => c.status === 'down')) return 'down';
    if (checks.some((c) => c.status === 'degraded')) return 'degraded';
    return 'ok';
  }

  async aggregate(): Promise<HealthReport> {
    const entries = [...this.checks.entries()];
    const checks = await Promise.all(entries.map(([name, fn]) => runCheck(name, fn)));
    return {
      overall: this.overallStatus(checks),
      checks,
      timestamp: new Date().toISOString(),
      version: this.version,
    };
  }
}

async function runCheck(name: string, fn: CheckFn): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const result = await fn();
    return { ...result, name, latencyMs: Date.now() - start };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { name, status: 'down', message, latencyMs: Date.now() - start };
  }
}
