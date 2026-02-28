/* eslint-disable @typescript-eslint/require-await */
import type {
  BlueGreenConfig,
  BlueGreenStrategy,
  DeploymentColor,
  DeploymentSlot,
  RollbackResult,
  SmokeTestCheck,
  SmokeTestResult,
  TrafficSwitchResult,
} from './types';

type HttpFn = (url: string) => Promise<{ ok: boolean; status: number }>;

/**
 * Blue-Green deployment manager.
 *
 * Manages two deployment slots (blue/green) and handles traffic switching,
 * rollback, and smoke tests.
 */
export class BlueGreenDeployment implements BlueGreenStrategy {
  private readonly slots = new Map<DeploymentColor, DeploymentSlot>();
  private _activeColor: DeploymentColor = 'blue';
  private readonly smokeChecks: Array<(color: DeploymentColor) => Promise<SmokeTestCheck>> = [];

  constructor(
    private readonly config: BlueGreenConfig,
    private readonly http: HttpFn = defaultHttp,
  ) {}

  get activeColor(): DeploymentColor {
    return this._activeColor;
  }

  get inactiveColor(): DeploymentColor {
    return this._activeColor === 'blue' ? 'green' : 'blue';
  }

  async deploy(color: DeploymentColor, image: string): Promise<DeploymentSlot> {
    const replicas = this.config.replicas ?? 2;
    const slot: DeploymentSlot = {
      color,
      image,
      replicas,
      readyReplicas: replicas,
      active: color === this._activeColor,
      createdAt: new Date(),
    };
    this.slots.set(color, slot);
    return slot;
  }

  async switchTraffic(to: DeploymentColor): Promise<TrafficSwitchResult> {
    const slot = this.slots.get(to);
    const from = this._activeColor;
    if (slot == null) {
      return {
        from,
        to,
        success: false,
        message: `Slot ${to} is not deployed`,
        switchedAt: new Date(),
      };
    }
    if (slot.readyReplicas < slot.replicas) {
      return {
        from,
        to,
        success: false,
        message: `Slot ${to} is not ready (${slot.readyReplicas}/${slot.replicas} replicas ready)`,
        switchedAt: new Date(),
      };
    }
    this.setActive(to);
    return {
      from,
      to,
      success: true,
      message: `Traffic switched from ${from} to ${to}`,
      switchedAt: new Date(),
    };
  }

  async rollback(reason: string): Promise<RollbackResult> {
    const from = this._activeColor;
    const to = this.inactiveColor;
    this.setActive(to);
    return {
      from,
      to,
      reason,
      rolledBackAt: new Date(),
    };
  }

  async runSmokeTests(color: DeploymentColor): Promise<SmokeTestResult> {
    const start = Date.now();
    const checks: SmokeTestCheck[] = [];

    // Built-in health check
    const healthResult = await this.runHealthCheck(color);
    checks.push(healthResult);

    // Custom checks
    for (const checkFn of this.smokeChecks) {
      const result = await checkFn(color);
      checks.push(result);
    }

    return {
      passed: checks.every((c) => c.passed),
      duration: Date.now() - start,
      checks,
    };
  }

  /** Register a custom smoke test check. */
  addSmokeCheck(fn: (color: DeploymentColor) => Promise<SmokeTestCheck>): this {
    this.smokeChecks.push(fn);
    return this;
  }

  getSlot(color: DeploymentColor): DeploymentSlot | null {
    return this.slots.get(color) ?? null;
  }

  private setActive(color: DeploymentColor): void {
    this._activeColor = color;
    for (const [c, slot] of this.slots) {
      slot.active = c === color;
    }
  }

  private async runHealthCheck(color: DeploymentColor): Promise<SmokeTestCheck> {
    const path = this.config.healthCheckPath ?? '/health';
    const port = this.config.port ?? 80;
    const url = `http://${this.config.appName}-${color}.${this.config.namespace}.svc.cluster.local:${port}${path}`;
    try {
      const res = await this.http(url);
      return {
        name: 'healthcheck',
        passed: res.ok,
        message: res.ok ? 'Health check passed' : `Health check failed with status ${res.status}`,
      };
    } catch (err) {
      return {
        name: 'healthcheck',
        passed: false,
        message: `Health check error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}

async function defaultHttp(url: string): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(url);
  return { ok: res.ok, status: res.status };
}
