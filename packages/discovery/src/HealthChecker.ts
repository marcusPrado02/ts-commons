/* eslint-disable @typescript-eslint/require-await */
import type { HealthStatus } from './types';

export interface HealthCheckEntry {
  instanceId: string;
  serviceName: string;
  checkFn: () => Promise<boolean>;
  intervalMs: number;
  consecutiveFailures: number;
  status: HealthStatus;
}

export class HealthChecker {
  private readonly checks = new Map<string, HealthCheckEntry>();
  private readonly changeHandlers: Array<(instanceId: string, status: HealthStatus) => void> = [];
  private readonly timers = new Map<string, ReturnType<typeof setInterval>>();

  register(
    instanceId: string,
    serviceName: string,
    checkFn: () => Promise<boolean>,
    intervalMs = 30_000,
  ): void {
    this.checks.set(instanceId, {
      instanceId,
      serviceName,
      checkFn,
      intervalMs,
      consecutiveFailures: 0,
      status: 'unknown',
    });
  }

  async check(instanceId: string): Promise<HealthStatus> {
    const entry = this.checks.get(instanceId);
    if (!entry) return 'unknown';

    let healthy: boolean;
    try {
      healthy = await entry.checkFn();
    } catch {
      healthy = false;
    }

    const previous = entry.status;
    if (healthy) {
      entry.consecutiveFailures = 0;
      entry.status = 'healthy';
    } else {
      entry.consecutiveFailures += 1;
      entry.status = 'unhealthy';
    }

    if (entry.status !== previous) {
      for (const handler of this.changeHandlers) {
        handler(instanceId, entry.status);
      }
    }

    return entry.status;
  }

  async checkAll(): Promise<Map<string, HealthStatus>> {
    const results = new Map<string, HealthStatus>();
    for (const instanceId of this.checks.keys()) {
      results.set(instanceId, await this.check(instanceId));
    }
    return results;
  }

  onHealthChange(handler: (instanceId: string, status: HealthStatus) => void): () => void {
    this.changeHandlers.push(handler);
    return () => {
      const idx = this.changeHandlers.indexOf(handler);
      if (idx !== -1) this.changeHandlers.splice(idx, 1);
    };
  }

  startPolling(instanceId: string): void {
    if (this.timers.has(instanceId)) return;
    const entry = this.checks.get(instanceId);
    if (!entry) return;
    const timer = setInterval(() => {
      void this.check(instanceId);
    }, entry.intervalMs);
    this.timers.set(instanceId, timer);
  }

  stopPolling(instanceId: string): void {
    const timer = this.timers.get(instanceId);
    if (timer !== undefined) {
      clearInterval(timer);
      this.timers.delete(instanceId);
    }
  }

  stopAll(): void {
    for (const instanceId of this.timers.keys()) {
      this.stopPolling(instanceId);
    }
  }

  getStatus(instanceId: string): HealthStatus {
    return this.checks.get(instanceId)?.status ?? 'unknown';
  }

  get registeredCount(): number {
    return this.checks.size;
  }
}
