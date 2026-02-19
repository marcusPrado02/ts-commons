export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthIndicator {
  readonly name: string;
  check: () => Promise<HealthStatus>;
}

export interface HealthReport {
  readonly status: HealthStatus;
  readonly checks: Record<string, HealthStatus>;
  readonly timestamp: number;
}

/**
 * Aggregates named health indicators.  Any indicator that throws is recorded
 * as `unhealthy`.  The overall status is the worst reported status:
 * unhealthy > degraded > healthy.
 */
export class HealthCheck {
  private readonly indicators: HealthIndicator[] = [];

  register(indicator: HealthIndicator): this {
    this.indicators.push(indicator);
    return this;
  }

  async check(): Promise<HealthReport> {
    const checks: Record<string, HealthStatus> = {};

    await Promise.all(
      this.indicators.map(async ind => {
        try {
          checks[ind.name] = await ind.check();
        } catch {
          checks[ind.name] = 'unhealthy';
        }
      }),
    );

    const statuses = Object.values(checks);
    let status: HealthStatus = 'healthy';

    if (statuses.some(s => s === 'unhealthy')) {
      status = 'unhealthy';
    } else if (statuses.some(s => s === 'degraded')) {
      status = 'degraded';
    }

    return { status, checks, timestamp: Date.now() };
  }
}
